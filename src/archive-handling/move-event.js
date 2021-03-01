'use strict';

const {
    firestore,
    firebase
} = require('../lib/setupFirebase.js');
// oldPath is the path that the original event came from
// th is the new event to go into the archive

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

const moveEvent = (oldPath, data) => {
    const {
        th
    } = data;
    // Grab the original record so we can delete it after
    console.log("Moving event", oldPath + th.eventId)
    var oldTownHallRef = firebase.ref(oldPath + th.eventId);
    let toSave;
    if (data.valid) {
        toSave = {
            ...th,
            error: false,
        }
 
    } else {
        toSave = {
            ...th,
            error: data.error,
        }

    }
    const checkIfNew = (eventId) => firestore.collection('archived_town_halls').doc(eventId).get()
        .then((snap) => {
            if (snap.exists) {
                return false;
            }
            return true;
        })

    return checkIfNew(th.eventId)
        .then((shouldSave) => {
            if (!shouldSave) {
                return Promise.resolve();
            }
            return saveNewEvent(th.eventId, toSave)
                .then(() => {
                    console.log('moved event', th.eventId)
                })
    
                
            })
            .then(oldTownHallRef.remove())
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
}

const saveNewEvent = (eventId, data) => {
    return firestore.collection('archived_town_halls').doc(eventId).set(data);
}

const updateEvent = (eventId, data) => {
    return firestore.collection('archived_town_halls').doc(eventId).update(data);
}

module.exports = {
    moveEvent,
    saveNewEvent,
    updateEvent,
}