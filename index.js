'use strict';

const fetch = require('node-fetch');
const fs = require('fs');
const randomstring = require('randomstring');
const OAuth2 = require('simple-oauth2');
const json2xls = require('json2xls');
const circuit = require('./circuit');
const express = require('express');
const Session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const store = require('./store');
require('log-timestamp');

// Overwrite config with env variables (production)
const config = require('./config.json');
config.circuit.client_id = process.env.CLIENT_ID || config.circuit.client_id;
config.circuit.client_secret = process.env.CLIENT_SECRET || config.circuit.client_secret;
config.circuit.domain = process.env.DOMAIN || config.circuit.domain;
config.app.domain = process.env.APP_DOMAIN || config.app.domain;

// Init storage and circuit modules
store.init();
circuit.init();

// OAuth2 redirect uri
const redirectUri = `${config.app.domain}/oauthCallback`

// simple-oauth2 configuration
const oauth2 = OAuth2.create({
  client: {
    id: config.circuit.client_id,
    secret: config.circuit.client_secret
  },
  auth: {
    tokenHost: `https://${config.circuit.domain}`
  }
});

// Configure view engine, render EJS templates and serve static assets
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Express middleware
app.set('port', (process.env.PORT || 3000));
app.use(bodyParser.json({type: 'application/json'}));
app.use(bodyParser.urlencoded({ extended: true }));

// Setup express session. No store used in this example.
app.use(Session({
  secret: 'secret-survey',
  resave: true,
  saveUninitialized: true
}));

// Middleware to ensure user is authenticated
function auth(req, res, next) {
  req.session.isAuthenticated ? next() : res.redirect('/');
}

app.get('/login', async (req, res) => {
  // Create state parameter to prevent CSRF attacks. Save in session.
  req.session.oauthState = randomstring.generate(12);

  // Redirect to OAuth2 authorize url
  const url = oauth2.authorizationCode.authorizeURL({
    redirect_uri: redirectUri,
    scope: config.circuit.scope,
    state: req.session.oauthState
  });
  res.redirect(url);
});

app.get('/', async (req, res) => {
  const data = {
    domain: config.circuit.domain,
    authenticated: req.session.isAuthenticated,
    displayName: req.session.displayName,
    surveys: [],
    conversations: []
  };

  if (req.session.isAuthenticated) {
    if (req.session.postdata) {
      // Submit since this is due to an oauth redirect and the user already clicked "Post"
      const survey = req.session.postdata;
      delete req.session.postdata;
      await circuit.postSurvey(req.session.userId, survey);
    }
    data.surveys = await store.getSettings(req.session.userId);
  }

  await render(req, res);
});

async function render(req, res) {
  res.render('index', {
    domain: config.circuit.domain,
    authenticated: req.session.isAuthenticated,
    displayName: req.session.displayName,
    surveys: await store.getSettings(req.session.userId)
  });
}

app.post('/post', async (req, res) => {
  const json = {
    convId: req.body.convId,
    question: req.body.question,
    answer1: req.body.answer1,
    answer2: req.body.answer2,
    answer3: req.body.answer3,
    answer4: req.body.answer4,
    answer5: req.body.answer5,
    answer1UserIds: [],
    answer2UserIds: [],
    answer3UserIds: [],
    answer4UserIds: [],
    answer5UserIds: [],

  }
  if (!req.session.isAuthenticated) {
    req.session.postdata = json;
    res.redirect('login');
  } else {
    await circuit.postSurvey(req.session.userId, json);
    await render(req, res);
  }
});

app.get('/logout', (req, res) => {
  req.session.isAuthenticated = false;
  res.redirect('/');
});

app.get('/export-xls', async (req, res) => {
  if (req.session.isAuthenticated) {
    const surveys = await store.getSettings(req.session.userId);
    const xls = json2xls(surveys);
    fs.writeFileSync('downloads/surveys.xlsx', xls, 'binary');
    res.download(__dirname + '/downloads/surveys.xlsx', 'surveys.xlsx');
  } else {
    res.render('error', {error: 'Not authenticated'});
  }
});

app.get('/export-json', async (req, res) => {
  if (req.session.isAuthenticated) {
    const surveys = await store.getSettings(req.session.userId);
    var json = JSON.stringify(surveys, null, 4);
    fs.writeFileSync('downloads/surveys.json', json), 'utf8';
    res.download(__dirname + '/downloads/surveys.json', 'surveys.json');
  } else {
    res.render('error', {error: 'Not authenticated'});
  }
});

app.get('/oauthCallback', async (req, res) => {
  // Verify code is present and state matches to prevent CSRF attacks
  if (req.query.code && req.session.oauthState === req.query.state) {
    try {
      // Get the access token using the code
      const result = await oauth2.authorizationCode.getToken({
        code: req.query.code,
        redirect_uri: redirectUri
      });
      if (result.error) {
        throw new Error('Error getting access token', result.error_description);
      }
      const token = oauth2.accessToken.create(result).token;
      req.session.isAuthenticated = true;

      const user = await fetch(`https://${config.circuit.domain}/rest/v2/users/profile`, {
        headers: { 'Authorization': 'Bearer ' +  token.access_token}
      }).then(res => res.json());

      req.session.userId = user.userId;
      req.session.displayName = user.displayName;
      store.saveToken(user.userId, token);

      await circuit.updateClientSubscription(user.userId);

      res.redirect('/');
    } catch (err) {
      console.error(err);
      res.render('error', {error: err});
    }
  } else {
      // Access denied
      res.render('error', {error: 'Access Denied'});
  }
});

// Start the server
let server = app.listen(app.get('port'), _ => {
  console.log(`App listening on port ${server.address().port}.`);
  console.log('Press Ctrl+C to quit.');
});
