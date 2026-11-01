"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const BATCHES = [
  { id: "keepa_reviews21plus_under1200", label: "21+ reviews, new price < INR 1200", env: { PASS: "1", REVIEW_MIN: "21", REVIEW_MAX: "none", PRICE_ABOVE: "", PRICE_BELOW: "1200" } },
  { id: "keepa_zero_reviews_1200_1600", label: "Keepa zero-review candidates, INR 1200 < new price < INR 1600", env: { PASS: "2", REVIEW_MIN: "1", REVIEW_MAX: "20", PRICE_ABOVE: "1200", PRICE_BELOW: "1600" } },
];
function read(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return null; }
}
function write(file, data) {
  fs.writeFileSync(file + ".tmp", JSON.stringify(data, null, 2));
  fs.renameSync(file + ".tmp", file);
}
function scope(batch) {
  return { reviewMin: Number(batch.env.REVIEW_MIN), reviewMax: batch.env.REVIEW_MAX === "none" ? null : Number(batch.env.REVIEW_MAX), onlyPass: Number(batch.env.PASS), priceAbove: batch.env.PRICE_ABOVE ? Number(batch.env.PRICE_ABOVE) : null, priceBelow: Number(batch.env.PRICE_BELOW), strictIsbn: true };
}
function complete(root, batch) {
  const dir = path.join(root, batch.id);
  const summary = read(path.join(dir, "collect_summary.json"));
  const checkpoint = read(path.join(dir, ".collect_checkpoint.json"));
  return Boolean(summary?.complete && !summary.endedOnError && checkpoint && checkpoint.passIndex >= 1 && !checkpoint.stack?.length && !checkpoint.pending?.length && JSON.stringify(checkpoint.scope) === JSON.stringify(scope(batch)) && JSON.stringify(summary.scope) === JSON.stringify(scope(batch)));
}
function alive(pid, script) {
  if (!Number.isSafeInteger(Number(pid)) || Number(pid) <= 0) return false;
  const result = spawnSync("/bin/ps", ["-p", String(pid), "-o", "state=,command="], { encoding: "utf8" });
  if (result.error || result.stderr?.trim()) return null;
  const value = result.stdout.trim();
  return result.status === 0 && !value.startsWith("Z") && value.includes(script);
}

async function runSequence(root = ROOT) {
  const dir = path.join(root, "keepa_batches");
  fs.mkdirSync(dir, { recursive: true });
  const lockFile = path.join(dir, "runner.lock");
  if (fs.existsSync(lockFile)) {
    const old = read(lockFile);
    const active = old ? alive(old.pid, path.join(root, "scripts", "keepa-batches.cjs")) : null;
    if (active !== false) throw new Error("Sequence already running, or its lock cannot be verified.");
    fs.unlinkSync(lockFile);
  }
  const lock = fs.openSync(lockFile, "wx");
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid }));
  fs.closeSync(lock);
  fs.writeFileSync(path.join(dir, "runner.pid"), String(process.pid) + "\n");
  let child = null;
  let stopped = false;
  let currentBatch = null;
  const completed = [];
  const record = (state, extra = {}) => write(path.join(dir, "status.json"), { state, pid: process.pid, currentBatch, completed: [...completed], updatedAt: new Date().toISOString(), ...extra });
  const stop = () => { stopped = true; if (child) child.kill("SIGTERM"); };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  try {
    for (const batch of BATCHES) {
      currentBatch = batch.id;
      if (stopped) throw new Error("Sequence interrupted; rerun the launcher to resume.");
      if (complete(root, batch)) {
        completed.push(batch.id);
        console.log(`Already complete: ${batch.label}`);
        continue;
      }
      const batchDir = path.join(root, batch.id);
      fs.mkdirSync(batchDir, { recursive: true });
      record("running");
      console.log(`Starting: ${batch.label}`);
      const output = fs.openSync(path.join(batchDir, "runner.log"), "a");
      let outcome;
      try {
        child = spawn(process.execPath, [path.join(root, "keepa_collect.js")], {
          cwd: batchDir,
          env: { ...process.env, ...batch.env, STRICT_ISBN: "1", MAX_MINUTES: "0", TOKEN_RATE: "120", DOTENV_CONFIG_PATH: path.join(root, ".env"), NODE_OPTIONS: "" },
          stdio: ["ignore", output, output],
        });
        if (child.pid) fs.writeFileSync(path.join(batchDir, "collector.pid"), String(child.pid) + "\n");
        outcome = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code, signal) => resolve({ code, signal })); });
      } finally { child = null; fs.closeSync(output); }
      if (stopped || outcome.code !== 0 || !complete(root, batch)) {
        const error = read(path.join(batchDir, "collect_summary.json"))?.endedOnError;
        throw new Error(`${batch.label} did not complete${error ? `: ${error}` : "; see its runner.log"}. Next batch was not started.`);
      }
      completed.push(batch.id);
      console.log(`Complete: ${batch.label}`);
    }
    record("complete");
    console.log("Both batches complete.");
  } catch (error) {
    record(stopped ? "stopped" : "failed", { error: error.message });
    throw error;
  } finally {
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
    fs.unlinkSync(lockFile);
  }
}

function showStatus(pingOnly = false, root = ROOT) {
  const status = read(path.join(root, "keepa_batches", "status.json"));
  const active = status ? alive(status.pid, path.join(root, "scripts", "keepa-batches.cjs")) : false;
  const state = active === null ? "UNKNOWN (cannot inspect process)" : active ? `RUNNING (PID ${status.pid})` : status?.state === "complete" ? "COMPLETE" : "STOPPED";
  console.log(`Sequence      : ${state}`);
  if (pingOnly) return;
  for (const [i, batch] of BATCHES.entries()) {
    const s = read(path.join(root, batch.id, ".collect_checkpoint.json"));
    const count = Number(s?.booksWritten || 0).toLocaleString("en-IN");
    const label = complete(root, batch) ? "COMPLETE" : active && status?.currentBatch === batch.id ? "RUNNING" : s ? "PAUSED" : "WAITING";
    console.log(`Batch ${i + 1}       : ${label} — ${batch.label}`);
    console.log(`Books saved   : ${count}`);
    console.log(`CSV           : ${path.join(root, batch.id, "books.csv")}`);
  }
  if (status?.error) console.log(`Last error    : ${status.error}`);
}

module.exports = { BATCHES, runSequence, scope, complete, showStatus };
if (require.main === module) {
  if (process.argv.includes("--status")) showStatus();
  else if (process.argv.includes("--ping")) showStatus(true);
  else runSequence().catch(error => { console.error(error.message); process.exitCode = 1; });
}
