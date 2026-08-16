const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const targetScript = process.argv[2];
const inputFile = process.argv[3];
const extraArgs = process.argv.slice(4);

if (!targetScript || !inputFile) {
  console.error(
    "❌ Usage: node utils/watcher.js <scraperScript> <inputFile> [--headless] [flags]",
  );
  process.exit(1);
}

const STALL_TIMEOUT_MS = 10 * 60 * 1000;
const RESTART_COOLDOWN_MS = 5000;
const MAX_LOG_BUFFER = 40;

const logsDir = path.join(__dirname, "..", "logs");
const crashLogPath = path.join(logsDir, "watcher-crashes.log");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

let restartCount = 0;
let child = null;
let stallTimer = null;
let logBuffer = [];
let isShuttingDown = false;

function logCrash(code, signal, reason) {
  const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
  const commandStr = `node ${targetScript} ${inputFile} ${extraArgs.join(" ")}`;

  const logEntry = [
    `================================================================================`,
    `[${timestamp}] CRASH / AUTO-RESTART #${restartCount}`,
    `Command:   ${commandStr}`,
    `Exit Code: ${code !== null ? code : "N/A"} | Signal: ${signal || "N/A"}`,
    `Reason:    ${reason}`,
    `--------------------------------------------------------------------------------`,
    `Recent Output (Last ${logBuffer.length} lines):`,
    ...logBuffer,
    `================================================================================\n\n`,
  ].join("\n");

  try {
    fs.appendFileSync(crashLogPath, logEntry, "utf8");
  } catch (err) {
    console.error(`⚠️ Failed to write to crash log: ${err.message}`);
  }
}

function resetStallTimer() {
  if (stallTimer) clearTimeout(stallTimer);
  stallTimer = setTimeout(() => {
    if (child && !child.killed) {
      console.log(
        `\n\x1b[31m⚠️ [Watcher] Stall detected: No activity for 10 minutes. Force-killing hung process...\x1b[0m`,
      );
      logCrash(
        null,
        "STALL_TIMEOUT",
        "Process stalled (>10 minutes without activity)",
      );
      try {
        child.kill("SIGKILL");
      } catch (e) {}
    }
  }, STALL_TIMEOUT_MS);
}

function startScraper() {
  if (isShuttingDown) return;

  const fullArgs = [targetScript, inputFile, ...extraArgs];
  const startTime = new Date().toLocaleTimeString();

  console.log(
    `\n\x1b[36m============================================================\x1b[0m`,
  );
  console.log(
    `\x1b[36m🛡️  [Watcher] Starting scraper (Attempt #${restartCount + 1}) at ${startTime}\x1b[0m`,
  );
  console.log(`\x1b[36m🎯 Script: node ${fullArgs.join(" ")}\x1b[0m`);
  console.log(
    `\x1b[36m============================================================\x1b[0m\n`,
  );

  logBuffer = [];
  resetStallTimer();

  child = spawn("node", fullArgs, {
    stdio: ["inherit", "pipe", "pipe"],
    cwd: path.join(__dirname, ".."),
  });

  const handleOutput = (data) => {
    resetStallTimer();
    const str = data.toString();
    const lines = str.split("\n").filter(Boolean);
    for (const line of lines) {
      logBuffer.push(line);
      if (logBuffer.length > MAX_LOG_BUFFER) {
        logBuffer.shift();
      }
    }
  };

  child.stdout.on("data", (data) => {
    process.stdout.write(data);
    handleOutput(data);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(data);
    handleOutput(data);
  });

  child.on("close", (code, signal) => {
    if (stallTimer) clearTimeout(stallTimer);

    if (isShuttingDown) {
      return;
    }

    if (code === 0) {
      console.log(
        `\n\x1b[32m🎉 [Watcher] Scraper completed all items successfully! Exiting watcher.\x1b[0m\n`,
      );
      process.exit(0);
    } else {
      restartCount++;
      const reason = signal
        ? `Terminated by signal ${signal} (possibly OOM killed)`
        : `Exited with code ${code}`;
      console.log(
        `\n\x1b[33m⚠️  [Watcher] Scraper stopped unexpectedly (${reason}).\x1b[0m`,
      );
      console.log(`\x1b[33m📝 Crash details saved to ${crashLogPath}\x1b[0m`);
      console.log(
        `\x1b[33m🔄 Auto-restarting in ${RESTART_COOLDOWN_MS / 1000}s... (Total Restarts: ${restartCount})\x1b[0m\n`,
      );

      logCrash(code, signal, reason);

      setTimeout(() => {
        startScraper();
      }, RESTART_COOLDOWN_MS);
    }
  });

  child.on("error", (err) => {
    console.error(
      `\x1b[31m❌ [Watcher] Failed to start child process: ${err.message}\x1b[0m`,
    );
    logCrash(null, "SPAWN_ERROR", err.message);
  });
}

// Graceful shutdown on Ctrl+C or kill
process.on("SIGINT", () => {
  isShuttingDown = true;
  if (stallTimer) clearTimeout(stallTimer);
  console.log(
    `\n\x1b[33m🛑 [Watcher] Interrupted by user. Shutting down...\x1b[0m`,
  );
  if (child && !child.killed) {
    child.kill("SIGINT");
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  isShuttingDown = true;
  if (stallTimer) clearTimeout(stallTimer);
  if (child && !child.killed) {
    child.kill("SIGTERM");
  }
  process.exit(0);
});

// Start the initial scraper process
startScraper();
