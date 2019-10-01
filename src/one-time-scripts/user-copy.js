#!/usr/bin/env node

'use strict';

const {
  firestore,
  firebase
} = require('..lib/setupFirebase');

firebase.ref('users').once('value')
  .then((snapshot) => {
    snapshot.forEach(userSnap => {
      const user = userSnap.val();
      if (user.isAdmin) {
        console.log('got admin')
        let newUser = {
          admin: true,
          username: user.username,
          email: user.email,
          uid: userSnap.key,
        }
        firestore.collection('users').doc(userSnap.key).set(newUser)
      }
    })
  })