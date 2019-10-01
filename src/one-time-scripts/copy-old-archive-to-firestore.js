#!/usr/bin/env node

'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const validate = require('../lib/schema.js');

const moveEvent = require('../archive-handling/move-event');
const makeArchiveEvent = require('../archive-handling/transform-to-archive-schema');
const getStateLegs = require('../lib/get-state-legs');

const {
    firebase
} = require('../lib/setupFirebase');


const validateEvent = (th) => {

    // Validate that it complies with our schema
    let valid = validate.townHall(th);
    if (!valid) console.log(validate.townHall.errors);

    return {
        th,
        valid,
        errors: !valid ? validate.townHall.errors : null,
    }
}


class TownHall {
    constructor(opts) {
        _.forEach(opts, (v, k) => {
            this[k] = v;
        })
    }

    static copyToNewArchive(level, realtimeArchivePath, archivePath) {
        const log = (...items) => {
            console.error(realtimeArchivePath, ...items);
        }

        const time = Date.now();

        return new Promise((res, rej) => {
                // Query firebase
                return firebase.ref(realtimeArchivePath)
                    .once('value')
                    .then(snap => {
                        const out = [];
                        // Make an array of records we can promisify
                        snap.forEach(dateSnap => {
                            dateSnap.forEach(s => {
                                out.push(new TownHall(s.val()));
                            })
                        })

                        // Resolve the promise with the records
                        res(out)
                    })
            })
            .tap(events => log("total events:", events.length))
            // Construct a new archive-schema event
            .map(th => makeArchiveEvent(level, th))
            .tap(events => log("passed JSON conversion:", events.length))
            // Ensure we have a valid event
            .map(tp => validateEvent(tp))
            .tap(events => log("valid events:", events.filter(data => data.valid).length))
            .tap(events => log("invalid events:", events.filter(data => !data.valid).length))
            // Actually move the event
            .map(th => moveEvent(realtimeArchivePath, th))
            // Log the number of events we actually moved
            // .tap(events => log("archived events:", events.valid.length))
            .catch(console.error);
    };
}


const states = ["AZ", "CO", 'FL', 'MD', 'ME', 'MI', 'MN', 'NC', 'NE', 'NV', 'OR', 'PA', 'VA'];
const promises = []
states.forEach(state => {
    promises.push(TownHall.copyToNewArchive(
        'state',
        `/archived_state_town_halls/${state}/`,
        `/archived_state_town_halls/${state}/`,
    ));
});

// promises.push(TownHall.copyToNewArchive('federal', '/archived_town_halls/', '/archived_town_halls/'));

return Promise.all(promises);
    // .then(() => {
    //     console.error("complete");
    //     process.exit(0);
    // })
