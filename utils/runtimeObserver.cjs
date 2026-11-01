// Dashboard-managed standalone jobs: durable generic process events, without parsing console messages as facts.
const { createJobLogger } = require('./jobEvents');
if (process.env.BOOK_EVENTS_FILE && process.env.BOOK_JOB_ID) {
  const emit = createJobLogger({ file: process.env.BOOK_EVENTS_FILE, jobId: process.env.BOOK_JOB_ID, attemptId: process.env.BOOK_ATTEMPT_ID, scraper: process.env.BOOK_SCRAPER });
  emit('process_started', { message: 'Scraper process started', pid: process.pid });
  for (const [stream, level] of [[process.stdout, 'info'], [process.stderr, 'warn']]) {
    const original = stream.write.bind(stream);
    let pending = '';
    stream.write = function(chunk, encoding, callback) {
      pending += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      let split;
      while ((split = pending.indexOf('\n')) >= 0) { emit('console', { level, message: pending.slice(0, split) }); pending = pending.slice(split + 1); }
      if (pending.length > 8192) { emit('console', { level, message: pending.slice(0, 8192) }); pending = ''; }
      return original(chunk, encoding, callback);
    };
  }
  process.on('uncaughtExceptionMonitor', error => emit('uncaught_exception', { level: 'error', message: error.message, stack: error.stack }));
  process.on('exit', code => emit('process_exited', { level: code ? 'warn' : 'info', exit_code: code, message: `Scraper exited with code ${code}; inspect result counts for outcome.` }));
}
