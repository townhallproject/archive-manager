
const validate = require('../lib/schema.js');

const validateEvent = (th) => {
    // Validate that it complies with our schema
    let valid = validate.townHall(th);
    return {
      th,
      valid,
      error: !valid ? validate.townHall.errors[0] : null,
    }
  }

  module.exports = validateEvent;