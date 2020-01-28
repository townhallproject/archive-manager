#!/usr/bin/env node

'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const validate = require('../lib/schema.js');

const { moveEvent } = require('../archive-handling/move-event');
const makeArchiveEvent = require('../archive-handling/transform-to-archive-schema');
const getStateLegs = require('../lib/get-state-legs');
const getMocData = require('../lib/get-moc-data');
const validateEvent = require('./validate-event');
const {
    firebase,
} = require('../lib/setupFirebase');

let mocData; 

const convertEvent = (level, th) => {
    // use mocdata for federal events missing chamber
    if (level === "federal" && th.govtrack_id && mocData) {
        const moc = mocData[th.govtrack_id];
        if (!th.chamber && moc.chamber) {
            const mapping = {
                House: 'lower',
                Senate: 'upper',
            }
            const newChamber = mapping[moc.chamber] || moc.chamber;
            th.chamber = newChamber;
        }
      
        if (moc.propublica_id) {
            th.officePersonId = moc.propublica_id;
        }
    }
    return makeArchiveEvent(level, th);
}


class TownHall {
    constructor(opts) {
        _.forEach(opts, (v, k) => {
            this[k] = v;
        })
    }

    static copyToNewArchive(level, realtimeArchivePath) {
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
            .map(th => convertEvent(level, th))
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

getMocData()
    .then(returnedData => {
        mocData = returnedData;
    })
    .then(() => {
        getStateLegs()
            .then(states => {
        
                const promises = [];
                states.forEach(state => {
                    promises.push(TownHall.copyToNewArchive(
                        'state',
                        `/archived_state_town_halls/${state}/`,
                    ));
                });
                
                promises.push(TownHall.copyToNewArchive('federal', '/archived_town_halls/'));
                
                return Promise.all(promises)
                    .then(() => {
                        console.error("complete");
                        process.exit(0);
                    })
        })
    })
