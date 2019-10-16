'use strict';

const express = require('express');
const getStateLegs = require('../lib/get-state-legs');
const moveEvent = require('../archive-handling/move-event');
const validateEvent = require('../one-time-scripts/validate-event');
const { firestore } = require('../lib/setupFirebase.js');

const app = express();
app.use(express.json());

app.post('/update-event', (req, res) => {
  const validated = validateEvent(req.body);
  console.log(validated);
  res.send('responding to update-event')
});

const server = app.listen(5000, () => {
  console.log('Listening on port ' + server.address().port);
});