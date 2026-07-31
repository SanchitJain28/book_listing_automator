const { startSpinner, stopSpinner } = require('./utils/spinner.js');
startSpinner("Loading data...");
setTimeout(() => {
  stopSpinner("Data loaded successfully!");
}, 2000);
