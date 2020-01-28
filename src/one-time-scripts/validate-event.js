
const validate = require('../lib/schema.js');

const validateEvent = (th) => {
    // Validate that it complies with our schema
    let valid = false;
    let error = null;
    if (th.repeatingEvent) {
      valid = validate.repeatingEvent(th)
      error = !valid ? validate.repeatingEvent.errors[0] : null;
    } else {
      delete th.repeatingEvent;
      valid = validate.townHall(th);
      error = !valid ? validate.townHall.errors[0] : null;
    }
    return {
      th,
      valid,
      error,
    }
  }

  module.exports = validateEvent;