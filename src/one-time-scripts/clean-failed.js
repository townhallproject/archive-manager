const _ = require('lodash');
const moment = require('moment-timezone');
const {
    firestore,
} = require('../lib/setupFirebase.js');
const validate = require('../lib/schema.js');

const TRANSFORM_KEYS = {
    dateObj: "timestamp",
    Location: "location",
    Notes: "notes",
}

const makeArchiveEvent = (th) => {
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

    return out;
}

firestore.collection('failed_archived_town_halls')
        .where("level",  "==", "state")
        .get()
        .then ((querySnapshot) => {
            querySnapshot.forEach((doc) => {
                const th = doc.data();

                if (th.error.dataPath === ".chamber" && th.district) {
                    const chamberKey = th.district.split('-')[0];
                    const mapping = {
                        SD: 'upper',
                        HD: 'lower',
                    }
                    const newChamber = mapping[chamberKey];
                    if (newChamber) {
                        let newTh = {
                            ...th,
                            chamber: newChamber,
                        }
                        newTh = makeArchiveEvent(newTh);
                        const valid = validate.townHall(newTh);
                        if (valid) {
                            console.log('now valid')
                            return firestore.collection('archived_town_halls').doc(newTh.eventId).set(newTh)
                                .then(() => {
                                    return firestore.collection('failed_archived_town_halls').doc(newTh.eventId).delete()
                                })
                        } else {
                            console.log('new error', validate.townHall.errors[0])
                            newTh.error = validate.townHall.errors[0];
                            return firestore.collection('failed_archived_town_halls').doc(newTh.eventId).set(newTh)
                        }
                    } else {
                        console.log('couldnt make chamber', th.district)
                    }
                }
            })


        }).catch(console.log)