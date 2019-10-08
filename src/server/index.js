'use strict';

const express = require('express');
const getStateLegs = require('../lib/get-state-legs');
const moveEvent = require('../archive-handling/move-event');
const { validateEvent } = require('../archive-handling');

const app = express();

app.post('/update-event', (req, res) => {
  getStateLegs().then((states) => {
      const promises = [];

    });
});

const server = app.listen(5000, () => {
  console.log('Listening on port ' + server.address().port);
});