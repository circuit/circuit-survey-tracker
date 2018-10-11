'use strict';
const jsonfile = require('jsonfile');
const fileExists = require('file-exists');

const DATA_FILE = './db/data.json';

let data;

function init() {
    !fileExists.sync(DATA_FILE) && jsonfile.writeFileSync(DATA_FILE, {});
    data = jsonfile.readFileSync(DATA_FILE);
}

function getValues() {
    let keys = Object.keys(data);
    return keys.map(v => { return data[v]; });
}

function getUsers() {
    return Object.keys(data);
}

var saveSettings = save.bind(null, 'settings');
var saveToken = save.bind(null, 'token');
var getSettings = get.bind(null, 'settings');
var getToken = get.bind(null, 'token');

function save(key, userId, obj) {
    return new Promise((resolve, reject) => {
        data[userId] = data[userId] || {};
        data[userId][key] = obj;
        jsonfile.writeFile(DATA_FILE, data, { spaces: 2 }, err => err ? reject(err) : resolve());
    });
}

function get(key, userId) {
    return !!data[userId] && data[userId][key];
}

module.exports = {
    init,
    getUsers,
    getValues,
    saveToken,
    getToken,
    saveSettings,
    getSettings
};
