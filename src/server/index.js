'use strict';

const express = require('express');
const { saveEvent } = require('../archive-handling/move-event');
const validateEvent = require('../one-time-scripts/validate-event');

const app = express();
app.use(express.json());

app.post('/update-event', (req, res) => {
  const {
    th,
    valid,
    error,
  } = validateEvent(req.body);
  th.error = valid ? false : error;
  saveEvent(th.eventId, th).then((writeResult) => {
    console.log(writeResult);
    res.send(th);
  });
});

const server = app.listen(5000, () => {
  console.log('Listening on port ' + server.address().port);
});