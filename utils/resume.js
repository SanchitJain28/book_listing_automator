const fs = require('fs');

/** Resume a sequential input from saved JSON Lines, regardless of result status. */
function getResumeIndex(file, items, identity) {
  if (!fs.existsSync(file)) return 0;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const records = [];
  let offset = 0;
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber];
    if (line.trim()) {
      try { records.push(JSON.parse(line)); }
      catch {
        // A killed append can leave an incomplete final line. Preserve it before
        // trimming so the unfinished input is processed again on restart.
        if (lineNumber !== lines.length - 1 || content.endsWith('\n')) {
          throw new Error(`Invalid output JSON at line ${lineNumber + 1} in ${file}; refusing to resume.`);
        }
        const backup = `${file}.partial-${Date.now()}-${process.pid}.bak`;
        fs.writeFileSync(backup, line, { flag: 'wx' });
        fs.truncateSync(file, Buffer.byteLength(content.slice(0, offset)));
        console.log(`[Resume] Preserved incomplete output tail in ${backup}; unfinished input will be retried.`);
      }
    }
    offset += line.length + 1;
  }
  // A complete last JSON record without a newline must not be joined to the next.
  if (records.length && fs.existsSync(file)) {
    const current = fs.readFileSync(file, 'utf8');
    if (current && !current.endsWith('\n')) fs.appendFileSync(file, '\n');
  }
  if (typeof identity !== 'function') {
    const startIndex = Math.min(records.length, items.length);
    if (records.length) console.log(startIndex === items.length
      ? `[Resume] All ${items.length} inputs already have saved output.`
      : `[Resume] ${startIndex}/${items.length} inputs saved. Continuing from item ${startIndex + 1}.`);
    return startIndex;
  }
  const positions = new Map();
  items.forEach((item, index) => {
    const key = identity(item);
    if (!positions.has(key)) positions.set(key, []);
    positions.get(key).push(index);
  });
  const completed = new Set();
  for (const record of records) {
    const matches = positions.get(identity(record));
    if (!matches) throw new Error(`Saved output does not match this input: ${file}. Use the original input or a new output file.`);
    const index = Number.isInteger(record.input_index) && matches.includes(record.input_index)
      ? record.input_index : matches.find(position => !completed.has(position));
    // Older runs may contain retries for an input already saved earlier.
    if (index !== undefined) completed.add(index);
  }
  let startIndex = 0;
  while (completed.has(startIndex)) startIndex++;
  if (records.length) console.log(startIndex === items.length
    ? `[Resume] All ${items.length} inputs already have saved output; no requests needed.`
    : `[Resume] ${startIndex}/${items.length} inputs saved. Continuing from item ${startIndex + 1}.`);
  return startIndex;
}

module.exports = { getResumeIndex };
