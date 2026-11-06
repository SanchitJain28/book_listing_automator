const { chromium } = require('playwright');

const api = 'http://localhost:5050';

async function profileRequest(profileId, suffix = '', method = 'GET') {
  const response = await fetch(api + '/profiles/' + profileId + suffix, {
    method,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error('Kameleo ' + method + ' ' + (suffix || 'profile') + ' returned HTTP ' + response.status);
  }
  return response.status === 204 ? null : response.json();
}

async function connectProfile(profileId) {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(profileId)) {
    throw new Error('--kameleo-profile requires a profile UUID from Kameleo');
  }
  const profile = await profileRequest(profileId);
  const product = profile.fingerprint?.browser?.product;
  if (!['chrome', 'edge'].includes(product)) {
    throw new Error('Select a Chromium-based Kameleo profile for this scraper');
  }
  console.log('Connecting to Kameleo profile ' + profile.name + ' (' + profileId + ')');
  // Kameleo starts the selected profile when this endpoint is connected.
  const browser = await chromium.connectOverCDP(
    'ws://localhost:5050/playwright/' + profileId,
    { timeout: 90000 },
  );
  return browser;
}

async function stopProfile(profileId) {
  // Stop through Kameleo so it persists the profile for the next run.
  const status = await profileRequest(profileId, '/status');
  if (status.lifetimeState === 'running') {
    await profileRequest(profileId, '/stop', 'POST');
  }
}

module.exports = { connectProfile, stopProfile };
