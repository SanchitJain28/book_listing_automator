const { cleanAndCheckMRP } = require("../../../utils/amazon");

function validateIsbnMatch(foundIsbn, targetIsbn) {
  if (!foundIsbn || !targetIsbn || foundIsbn === "N/A") return false;
  const cleanFound = foundIsbn.replace(/[^0-9X]/gi, "");
  const cleanTarget = targetIsbn.replace(/[^0-9X]/gi, "");
  return cleanFound === cleanTarget;
}

module.exports = {
  cleanAndCheckMRP,
  validateIsbnMatch,
};
