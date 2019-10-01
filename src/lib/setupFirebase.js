'use strict';

require('dotenv').config();

const Promise = require('bluebird');
const admin = require('firebase-admin');

const testing = process.env.NODE_ENV !== 'production';
const key = testing ? process.env.TESTING_FIREBASE_TOKEN : process.env.FIREBASE_TOKEN
const firebasekey = key.replace(/\\n/g, '\n');
console.log('TESTING:', testing)

const app = admin.initializeApp(
    {
        credential: admin.credential.cert({
            type: 'service_account',
            projectId: testing ? process.env.TESTING_PROJECT_ID : process.env.FIREBASE_ID,
            clientEmail: testing ? process.env.TESTING_CLIENT_EMAIL : process.env.FIREBASE_EMAIL,
            privateKey: firebasekey
        }),
        databaseURL: testing ? process.env.TESTING_DATABASE_URL : process.env.FIREBASE_DB_URL
    }
);
//admin.database.enableLogging(true);

// Export together as single object
module.exports = {
    firestore: app.firestore(),
    firebase: app.database()
};

