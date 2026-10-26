const { cleanAndCheckMRP } = require("../../../utils/amazon");

const { sameIsbn, isValidIsbn } = require('./isbn');

function validateIsbnMatch(foundIsbn, targetIsbn) {
  return isValidIsbn(foundIsbn) && isValidIsbn(targetIsbn) && sameIsbn(foundIsbn, targetIsbn);
}

module.exports = {
  cleanAndCheckMRP,
  validateIsbnMatch,
};
