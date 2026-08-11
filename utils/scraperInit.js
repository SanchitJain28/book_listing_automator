const path = require("path");

function initScraper(scriptName, scraperFolder, stageSuffix) {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error(`Usage: node ${scriptName} <path-to-input.txt> [--headless]`);
    process.exit(1);
  }

  const isHeadless = process.argv.includes("--headless");
  const absoluteInput = path.resolve(inputFile);
  const inputDataRoot = path.join(__dirname, "..", "input-data");

  let relativePath = path.relative(inputDataRoot, absoluteInput);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    const fileName = path.basename(inputFile, path.extname(inputFile));
    const inputFolderName = path.basename(path.dirname(inputFile));
    relativePath = path.join(scraperFolder, `${inputFolderName}-${fileName}`);
  } else {
    const parsedPath = path.parse(relativePath);
    relativePath = path.join(parsedPath.dir, parsedPath.name);
    stageSuffix = ".json";
  }

  const outputFilePath = path.join(
    __dirname,
    "..",
    "output",
    `${relativePath}${stageSuffix}`,
  );

  return { inputFile, isHeadless, outputFilePath };
}

module.exports = { initScraper };
