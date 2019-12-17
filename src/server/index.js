'use strict';

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { saveEvent } = require('../archive-handling/move-event');
const validateEvent = require('../one-time-scripts/validate-event');

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'http://thp-admin.herokuapp.com' : 'http://localhost:3000',
}));

app.post('/event', (req, res) => {
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