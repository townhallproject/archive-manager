#!/usr/bin/env node

'use strict';

const _ = require('lodash');
const Promise = require('bluebird');

const validate = require('../lib/schema.js');
const getStateLegs = require('../lib/get-state-legs');
const {
  firebase
} = require('../lib/setupFirebase');

const { moveEvent } = require('./move-event');
const makeArchiveEvent = require('./transform-to-archive-schema');
const validateEvent = require('../one-time-scripts/validate-event');


const checkTimestamp = (th, now) => {
  // If this event has no date, skip it
  if (!th.dateObj) {
    if (!th.repeatingEvent) {

      console.log('missing date object', th.eventId)
    }
    return false;
  }

  // If this event is newer than the current time, skip it
  if (th.dateObj >= now) {
    return false;
  }

  // If this event is a repeating event, skip it

  if (th.repeatingEvent) {
    return false;
  }
  return true;
}

class TownHall {
  constructor(opts) {
    _.forEach(opts, (v, k) => {
      this[k] = v;
    })
  }

  static removeOld (level, townhallPath, archivePath) {
    const log = (...items) => {
      console.error(townhallPath, ...items);
    }

    const time = Date.now();

    return new Promise((res, rej) => {
      // Query firebase
      return firebase.ref(townhallPath)
        .once('value')
        .then(snap => {
          const out = [];

          // Make an array of records we can promisify
          snap.forEach(s => {
            out.push(new TownHall(s.val()));
          })

          // Resolve the promise with the records
          res(out)
        })
      })
      .tap(events => log("total events:", events.length))
      // Filter out any events too new, recurring, etc.
      .filter(th => checkTimestamp(th, time))
      .tap(events => log("past events:", events.length))
      // Construct a new archive-schema event
      .map(th => makeArchiveEvent(level, th))
      .tap(events => log("passed conversion:", events.length))
      // Ensure we have a valid event
      .map(tp => validateEvent(tp))
      .tap(events => log("valid events:", events.filter(data => data.valid).length))
      .tap(events => log("invalid events:", events.filter(data => !data.valid).length))
      // Actually move the event
      .map(th => moveEvent(townhallPath, th))
      // Log the number of events we actually moved
      // .tap(events => log("archived events:", events.valid.length))
      .catch(console.error);
  };
}

getStateLegs()
.then(states => {
  console.log('states', states);

  const promises = []
  states.forEach(state => {
    promises.push(TownHall.removeOld(
      'state',
      `/state_townhalls/${state}/`,
      `/archived_state_town_halls/${state}/`,
    ));
  });

  promises.push(TownHall.removeOld('federal', '/townHalls/', '/archived_town_halls/'));

  return Promise.all(promises);
})
.then(() => {
  console.error("complete");
  process.exit(0);
})

