async function closeExtraPages(context, mainPage) {
  const extra = context.pages().filter(page => page !== mainPage);
  const closed = await Promise.allSettled(extra.map(page => page.close()));
  if (closed.some(result => result.status === 'rejected')) throw new Error('Could not close an extra browser page; recycle the context before continuing.');
  return extra.length;
}

function createRecyclingPageSession({ open, recycleEvery = 100, logger = console.log }) {
  if (!Number.isInteger(recycleEvery) || recycleEvery < 1) throw new Error('recycleEvery must be a positive integer.');
  let current = null, completed = 0, generation = 0, recycleRequired = false;
  return {
    async getPage() {
      if (current && (completed >= recycleEvery || recycleRequired || current.page.isClosed())) {
        await current.context.close(); current = null;
      }
      if (!current) {
        current = await open(); completed = 0; recycleRequired = false; generation++;
        logger(`[Browser] Opened context generation ${generation}.`);
      }
      return current.page;
    },
    async afterRecord() {
      completed++;
      try { await closeExtraPages(current.context, current.page); }
      catch { recycleRequired = true; }
      if (completed % 25 === 0) logger(`[Browser] ${completed} inputs in context; ${current.context.pages().length} open page(s); Node RSS ${Math.round(process.memoryUsage().rss / 1024 ** 2)} MiB.`);
    },
    async close() { const active = current; current = null; if (active) await active.context.close(); },
    stats() { return { generation, completed, openPages: current?.context.pages().length || 0 }; },
  };
}
module.exports = { closeExtraPages, createRecyclingPageSession };
