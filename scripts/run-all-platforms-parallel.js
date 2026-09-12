const path = require("path");
const { spawn } = require("child_process");

const scrapers = [
  {
    name: "AbeBooks.com (US)",
    script: "scrapers/abebooks/abebooks-isbn.js",
    input: "input-data/abebooks/isbns/2026-09-12/input.txt"
  },
  {
    name: "AbeBooks UK",
    script: "scrapers/abebooks-uk/abebooks-uk-isbn.js",
    input: "input-data/abebooks-uk/isbns/2026-09-12/input.txt"
  },
  {
    name: "Iberlibro (Spain)",
    script: "scrapers/iberlibro/iberlibro-isbn.js",
    input: "input-data/iberlibro/isbns/2026-09-12/input.txt"
  },
  {
    name: "Amazon US (.com)",
    script: "scrapers/amazon-us-isbn/amazon-us-isbn.js",
    input: "input-data/amazon-us/isbns/2026-09-12/input.txt"
  },
  {
    name: "Amazon Canada (.ca)",
    script: "scrapers/amazon-ca-isbn/amazon-ca-isbn.js",
    input: "input-data/amazon-ca/isbns/2026-09-12/input.txt"
  },
  {
    name: "Amazon UK (.co.uk)",
    script: "scrapers/amazon-uk-isbn/amazon-uk-isbn.js",
    input: "input-data/amazon-uk/isbns/2026-09-12/input.txt"
  },
];

console.log("==================================================");
console.log("🚀 Launching 6 Platform-Specific Scrapers in Parallel");
console.log("==================================================\n");

scrapers.forEach((s) => {
  console.log(`▶ Starting [${s.name}] with ${s.input}...`);
  const child = spawn("node", [s.script, s.input, "--headless"], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });

  child.on("close", (code) => {
    console.log(`🏁 [${s.name}] finished with exit code ${code}`);
  });
});
