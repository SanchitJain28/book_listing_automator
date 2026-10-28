/** Create a new isolated context without activating each headed Chromium window. */
async function createContextPage(browser, settings, { backgroundSession = null } = {}) {
  const before = backgroundSession
    ? (await backgroundSession.send('Target.getBrowserContexts')).browserContextIds
    : null;
  const context = await browser.newContext(settings);
  try {
    if (!backgroundSession) return { context, page: await context.newPage() };
    const after = (await backgroundSession.send('Target.getBrowserContexts')).browserContextIds;
    const created = after.filter(id => !before.includes(id));
    if (created.length !== 1) throw new Error(`Expected one new Chromium context, got ${created.length}.`);
    const [page] = await Promise.all([
      context.waitForEvent('page', { timeout: 15000 }),
      backgroundSession.send('Target.createTarget', {
        url: 'about:blank',
        browserContextId: created[0],
        background: true,
        focus: false,
      }),
    ]);
    return { context, page };
  } catch (error) {
    await context.close().catch(() => {});
    if (backgroundSession) error.code = 'BACKGROUND_PAGE_FAILURE';
    throw error;
  }
}

module.exports = { createContextPage };
