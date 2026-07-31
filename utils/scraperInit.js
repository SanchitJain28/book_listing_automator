const path = require("path");

function initScraper(scriptName, scraperFolder, stageSuffix) {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error(`Usage: node ${scriptName} <path-to-input.txt> [--headless]`);
    process.exit(1);
  }

  const isHeadless = process.argv.includes("--headless");
  const fileName = path.basename(inputFile, path.extname(inputFile));
  const inputFolderName = path.basename(path.dirname(inputFile));
  
  const outputFilePath = path.join(
    __dirname,
    "..",
    "output",
    scraperFolder,
    `${inputFolderName}-${fileName}${stageSuffix}`
  );

  return { inputFile, isHeadless, outputFilePath };
}

module.exports = { initScraper };
