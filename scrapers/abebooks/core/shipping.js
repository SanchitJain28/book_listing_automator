/**
 * Formats shipping text strings from AbeBooks listings.
 * @param {string} rawText
 * @returns {string}
 */
function formatShipping(rawText) {
  if (!rawText || rawText === "N/A") return "N/A";
  const firstLine = rawText.split("\n")[0];
  const match = firstLine.match(/(.*?shipping)/i);
  return match ? match[1].trim() : firstLine.trim();
}

module.exports = { formatShipping };
