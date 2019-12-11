#!/usr/bin/env node

'use strict';

const _ = require('lodash');
const moment = require('moment-timezone');

const validate = require('../lib/schema.js');

// This maps keys from the live event to the keys of the archive event.
// Only add keys here that need to be transformed. Keys to be copied
// straight across can be added to the KEEP_KEYS list.
const TRANSFORM_KEYS = {
    dateObj: "timestamp",
    Location: "location",
    Notes: "notes",
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

    // Copy Member to displayName
    if (!out.displayName && th.Member) {
        out.displayName = th.Member
    }

    // Cast the govtrack_id to an int if it's present
    if (th.govtrack_id && th.govtrack_id !== "") {
        out.govtrack_id = parseInt(th.govtrack_id, 10);
    }

    // Set the human-readable timestamps
    const tzString = th.zoneString ? th.zoneString : 'UTC';
    out.timeStart = moment(th.dateObj).tz(tzString).format();
    out.timeEnd = moment(`${th.yearMonthDay} ${th.timeEnd}`, 'YYYY-MM-DD hh:mm A').tz(tzString).format();
    out.timeZone = tzString;
    out.lastUpdated = moment(th.lastUpdated).tz(tzString).format();
    out.repeatingEvent = th.repeatingEvent || false;
    // Cast the House and Senate to lower and upper
    switch (th.chamber) {
        case 'House':
            out.chamber = 'lower';
            break;
        case 'Senate':
            out.chamber = 'upper';
            break
    }

    // adding chamber for state events
    if (level === "state" && !out.chamber && th.district) {
           const chamberKey = th.district.split('-')[0];
           const mapping = {
               SD: 'upper',
               HD: 'lower',
           }
           if (mapping[chamberKey]) {
               out.chamber = mapping[chamberKey];
           }
    }


    // set a default level if it's not present
    if (!out.level || out.level === "") {
        out.level = level;
    }

    return out;
}

module.exports = makeArchiveEvent;