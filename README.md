# Circuit Survey Tracker

** Under construction

- App to post surveys to Circuit on your behalf
- Survey is shown using the new SDK forms feature
- Surveys are tracked server side in a json file
- Survey results shown in app, or downloadable as xlsx or json

App uses OAuth2 Authorization Code Grant type, and using the created access token the app remains connected to the SDK websocket on your behalf to receive survey answers.

In the future additional form elements will be supported, not only voting buttons.

## Setup
- Register your app (see https://circuit.github.io)
- Rename config.json.template to config,json and modify accordingly
- Run app using `npm start`

