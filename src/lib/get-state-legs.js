const lodash = require('lodash');
const { filter, map } = lodash;
const {
    firebase
} = require('./setupFirebase.js');

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
        .then(states => map(filter(states, 'has_events'), 'state'));
};

module.exports = getStateLegs;