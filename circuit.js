
'use strict';
const Circuit = require('circuit-sdk');
const store = require('./store');

// Load configuration
const config = require('./config.json');

// Subscriptions hastable with userId as key. Values are the client object and the listener
let subscriptions = {};

async function init() {
  // On startup subscribe for all users so events can be received
  for (const userId of store.getUsers()) {
    try {
      await logon(userId);
      subscribe(userId);
    } catch (err) {
      console.error(err);
    }
  }
}

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function postSurvey(userId, survey) {
  const client = subscriptions[userId] && subscriptions[userId].client;
  const formId = generateId();
  const form = {
    "id": formId,
    "controls": [{
      "type": "LABEL",
      "text": survey.question
    }, {
      "type": "BUTTON",
      "name": "answers",
      "options": [{
        "notification": "Form submitted successfully",
        "text": survey.answer1,
        "value": "1"
      }]
    }]
  };

  survey.answer2 && form.controls[1].options.push({
    "notification": "Form submitted successfully",
    "text": survey.answer2,
    "value": "2"
  });
  survey.answer3 && form.controls[1].options.push({
    "notification": "Form submitted successfully",
    "text": survey.answer3,
    "value": "3"
  });
  survey.answer4 && form.controls[1].options.push({
    "notification": "Form submitted successfully",
    "text": survey.answer4,
    "value": "4"
  });
  survey.answer5 && form.controls[1].options.push({
    "notification": "Form submitted successfully",
    "text": survey.answer5,
    "value": "5"
  });

  const item = await client.addTextItem(survey.convId, {
    form: form
  });
  survey.formId = formId;
  survey.itemId = item.itemId;

  const surveys = await store.getSettings(userId) || [];
  surveys.push(survey);
  await store.saveSettings(userId, surveys);
  console.log('Posting:', survey);
  console.log(`User now has ${surveys.length} survey(s)`);
}

// Check if user is authenticated
function isAuthenticated(userId) {
    return new Promise((resolve, reject) => {
        let client = subscriptions[userId] && subscriptions[userId].client;
        if (!client) {
            reject(userId);
            return;
        }
        return client.isAuthenticated().then(resolve);
    });
}

// Logout user
function logout(userId) {
    return new Promise((resolve, reject) => {
        let client = subscriptions[userId] && subscriptions[userId].client;
        if (client) {
          const email = client.loggedOnUser.emailAddress;
          client.logout()
              .then(() => {
                console.log(`Logged out user ${email}`);
                resolve();
              })
              .catch(reject);
        } else {
            resolve();
        }
    });
}

// Logon using access token
async function logon(userId) {
  const token = store.getToken(userId);
  if (!token || !token.access_token) {
    throw new Error('No token for user ' + userId);
  }
  const client = new Circuit.Client({
    domain: config.circuit.domain,
    client_id: config.circuit.client_id,
    scope: config.circuit.scope
  });
  const user = await client.logon({ accessToken: token.access_token });
  subscriptions[user.userId] = { client: client };
  console.log(`Logged on user ${user.emailAddress}`);
}

function subscribe(userId) {
    const onFormSubmission = handleFormSubmission.bind(null, userId);
    const client = subscriptions[userId].client;
    client.addEventListener('formSubmission', onFormSubmission);
    subscriptions[userId].onFormSubmissionListener = onFormSubmission;
}

function unsubscribe(userId) {
  const s = subscriptions[userId];
  if (s) {
    s.client.removeEventListener('formSubmission', s.onFormSubmissionListener);
    delete subscriptions[userId].onFormSubmissionListener;
  }
}

async function updateClientSubscription(userId) {
  unsubscribe(userId);
  await logout(userId);
  await logon(userId);
  subscribe(userId);
}

async function getEmails(userIds) {
  const users = await client.getUsersById(userIds);
  return users.map(user => user.emailAddress);
}

async function handleFormSubmission(userId, evt) {
  console.log('handleFormSubmission', userId, evt);
  const surveys = store.getSettings(userId);
  const client = subscriptions[userId].client;

  const survey = surveys.find(s => s.formId === evt.form.id);
  if (!survey) {
    console.error('Receiving formSubmission for unknown formId', evt);
    return;
  }

  const {emailAddress} = await client.getUserById(evt.submitterId);

  switch (evt.form.data[0].value) {
    case '1':
    survey.answer1UserIds.push(emailAddress);
    console.log('Answer 1 selected');
    break;
    case '2':
    survey.answer2UserIds.push(emailAddress);
    console.log('Answer 2 selected');
    break;
    case '3':
    survey.answer3UserIds.push(emailAddress);
    console.log('Answer 3 selected');
    break;
    case '4':
    survey.answer4UserIds.push(emailAddress);
    console.log('Answer 4 selected');
    break;
    case '5':
    survey.answer5UserIds.push(emailAddress);
    console.log('Answer 5 selected');
    break;
    default:
    console.error('Unknown survey choice');
  }

  await store.saveSettings(userId, surveys);

  /*
  form:Object {id: "ecah0uic6u7wm7nnwyirt", data: Array(1)}
  itemId:"87010568-68b6-40c3-a1df-287992496393"
  submitterId:"0e372ae0-2dff-4439-8f87-1b8a6562f80e"
  type:"formSubmission"
  */
}

module.exports = {
    init,
    updateClientSubscription,
    postSurvey,
    getEmails
};
