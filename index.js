#!/usr/bin/env node

'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const lodash = require('lodash');
const moment = require('moment-timezone');
const validate = require('./lib/schema.js');

const {
  firestore,
  firebase
} = require('./lib/setupFirebase.js');

// This maps keys from the live event to the keys of the archive event.
// Only add keys here that need to be transformed. Keys to be copied
// straight across can be added to the KEEP_KEYS list.
const TRANSFORM_KEYS = {
  dateObj: "timestamp",
  Location: "location",
  Notes: "notes",
}

// Get all the state legistlatures covered by the project
const getStateLegs = () => {
  return firebase
  .ref('states')
  .once('value')
  .then(snapshot => {
    const statesToReturn = [];

    snapshot.forEach(ele => {
        statesToReturn.push(ele.val());
    });

    return statesToReturn;
  })
  .then(states => lodash.map(lodash.filter(states, 'state_legislature_covered'), 'state'));
};

// Get the user ID if it's not an email address
const getUserId = townHall => {
  if (townHall.userID && townHall.enteredBy.includes('@')) {
      return townHall.userID;
  }

  if (townHall.enteredBy && townHall.enteredBy.includes('@')) {
      return;
  }

  return townHall.enteredBy;
}

const updateUserWhenEventArchived = townhall => {
  const uid = getUserId(townhall);

  if (!uid) {
      return Promise.resolve();
  }

  const path = `users/${uid}`;
  const currentEvent = {
      status: 'archived',
  };

  return firebase.ref(`${path}/events/${townhall.eventId}`).update(currentEvent);
};

const checkTimestamp = (th, now) => {
  // If this event has no date, skip it
  if (!th.dateObj) {
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

const makeArchiveEvent = (level, th) => {
  const out = {};

  // Initialize our object with default values for all the keys
  _.forEach(validate.townHallSchema.properties, (attrs, property) => {
    if (th[property] && th[property] !== undefined) {
      out[property] = th[property];
      return;
    }

    switch (attrs.type) {
      case "string":
        out[property] = '';
        break;
      case "integer":
        out[property] = 0;
        break;
      case "number":
        out[property] = 0;
        break;
      case "boolean":
        out[property] = false;
        break;
    }
  })

  // Add the fields we want to transform the name of
  _.forEach(TRANSFORM_KEYS, (v, k) => {
    if (th[k]) out[v] = th[k];
  })

  // Cast the govtrack_id to an int if it's present
  if (th.govtrack_id && th.govtrack_id !== "") {
    out.govtrack_id = parseInt(th.govtrack_id, 10);
  }

  // Set the human-readable timestamps
  const tzString = th.zoneString ? th.zoneString : 'UTC';
  out.timeStart = moment(th.dateObj).tz(tzString).format();
  out.timeEnd = moment(`${th.yearMonthDay} ${th.timeEnd}`, 'YYYY-MM-DD hh:mm A').tz(tzString).format();
  out.lastUpdated = moment(th.lastUpdated).tz(tzString).format();

  // Cast the House and Senate to lower and upper
  switch (th.chamber) {
    case 'House':
      out.chamber = 'lower';
      break;
    case 'Senate':
      out.chamber = 'upper';
      break
  }

  // set a default level if it's not present
  if (!out.level || out.level === "") {
    out.level = level;
  }

  return out;
}

const validateEvent = (th) => {
  // Validate that it complies with our schema
  let valid = validate.townHall(th);
  return {
    th,
    valid,
  }
}

// oldPath is the path that the original event came from
// th is the new event to go into the archive
const moveEvent = (oldPath, data) => {
  const { th, valid } = data;
  // Grab the original record so we can delete it after
  var oldTownHall = firebase.ref(oldPath + th.eventId);
  if (valid) {
    return firestore.collection('archived_town_halls').doc(th.eventId).set(th)
      .then(() => {
        // console.log('moved event', th.eventId)
      })
  } else {
    return firestore.collection('failed_archived_town_halls').doc(th.eventId).set(th)
      .then(() => {
        console.log('moved failed event', th.eventId);
        return firebase.ref(`failed_archived_town_halls/${th.eventId}`).update(th)
      })
  }
  /*
  .then(oldTownHall.remove)
  .then(() => {
    // Update the table of archived event refs
    return firebase.ref(`/townHallIds/${th.eventId}`).update({
        status: 'archived',
        archive_path: 'archived_town_halls',
    });
  })
  .then(() => {
    // Update an event join against a user?
    updateUserWhenEventArchived(th);
  })
  */
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
  // console.log('states', states);

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


