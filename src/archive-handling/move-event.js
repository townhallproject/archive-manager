'use strict';

const {
    firestore,
    firebase
} = require('../lib/setupFirebase.js');
// oldPath is the path that the original event came from
// th is the new event to go into the archive

const moveEvent = (oldPath, data) => {
    const {
        th
    } = data;
    // Grab the original record so we can delete it after
    var oldTownHall = firebase.ref(oldPath + th.eventId);
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

    return checkIfNew(th.eventId).then((shouldSave) => {
        if (!shouldSave) {
            return Promise.resolve();
        }
        return saveNewEvent(th.eventId, toSave)
            .then(() => {
                console.log('moved event', th.eventId)
            })
    
            //   .then(oldTownHall.remove)
            //       .then(() => {
            //           // Update the table of archived event refs
            //           return firebase.ref(`/townHallIds/${th.eventId}`).update({
            //               status: 'archived',
            //               archive_path: 'archived_town_halls',
            //           });
            //       })
            //       .then(() => {
            //           // Update an event join against a user?
            //           updateUserWhenEventArchived(th);
            //       })
        
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