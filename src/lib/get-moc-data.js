const {
    firebase
} = require('./setupFirebase.js');

// Get all the state legistlatures covered by the project
const getMocData = () => {
    return firebase
        .ref('mocData')
        .once('value')
        .then(snapshot => {
            const mocData = {};

            snapshot.forEach(ele => {
                mocData[ele.key] = ele.val()
            });

            return mocData;
        })
};

module.exports = getMocData;