const cliSpinners = require("cli-spinners");
const spinners = cliSpinners.default || cliSpinners;
const readline = require("readline");

let spinnerInterval;

function startSpinner(text) {
  if (spinnerInterval) clearInterval(spinnerInterval);
  
  const spinner = spinners.star;
  let i = 0;
  
  process.stdout.write("\x1B[?25l"); // hide cursor
  
  // Initial frame
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(`\x1b[36m${spinner.frames[i]}\x1b[0m ${text}`);
  
  spinnerInterval = setInterval(() => {
    i = (i + 1) % spinner.frames.length;
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(`\x1b[36m${spinner.frames[i]}\x1b[0m ${text}`);
  }, spinner.interval);
}

function updateSpinner(text) {
  if (spinnerInterval) {
    // If we want to change text while spinning
    clearInterval(spinnerInterval);
    startSpinner(text);
  }
}

function stopSpinner(text, type = "success") {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
  }
  
  readline.cursorTo(process.stdout, 0);
  readline.clearLine(process.stdout, 0);
  process.stdout.write("\x1B[?25h"); // show cursor
  
  if (type === "success") {
    console.log(`\x1b[32m✔\x1b[0m ${text}`);
  } else if (type === "error") {
    console.log(`\x1b[31m✖\x1b[0m ${text}`);
  } else if (type === "warn") {
    console.log(`\x1b[33m⚠\x1b[0m ${text}`);
  } else if (type === "info") {
    console.log(`\x1b[34mℹ\x1b[0m ${text}`);
  } else {
    if (text) console.log(text);
  }
}

module.exports = { startSpinner, stopSpinner, updateSpinner };
