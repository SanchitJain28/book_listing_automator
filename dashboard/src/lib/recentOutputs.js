const DB_NAME = 'book-listing-workspace';
const LIMIT = 5;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('Browser storage is unavailable.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('recents', { keyPath: 'id' });
      request.result.createObjectStore('contents', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Browser storage is busy in another tab.'));
  });
}

async function transaction(mode, action) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['recents', 'contents'], mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || new Error('Browser storage operation failed.'));
      tx.onerror = () => reject(tx.error || new Error('Browser storage operation failed.'));
      action(tx, value => { result = value; });
    });
  } finally { db.close(); }
}

export function listRecentOutputs() {
  return transaction('readonly', (tx, done) => {
    const request = tx.objectStore('recents').getAll();
    request.onsuccess = () => done(request.result.sort((a, b) => b.openedAt - a.openedAt));
  });
}

export async function saveRecentOutput(file, content, count) {
  // The same filename and content reuse an entry; different versions stay distinct.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${file.projectPath || file.name}\0${content}`));
  const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const metadata = { id, name: file.name, size: file.size, count, openedAt: Date.now(), projectPath: file.projectPath || null, kind: file.kind || 'books' };
  await transaction('readwrite', tx => {
    const recents = tx.objectStore('recents');
    const contents = tx.objectStore('contents');
    recents.put(metadata);
    contents.put({ id, content });
    const request = recents.getAll();
    request.onsuccess = () => {
      request.result.sort((a, b) => b.openedAt - a.openedAt).slice(LIMIT).forEach(item => {
        recents.delete(item.id);
        contents.delete(item.id);
      });
    };
  });
  return metadata;
}

export function readRecentOutput(id) {
  return transaction('readwrite', (tx, done) => {
    const metadataRequest = tx.objectStore('recents').get(id);
    metadataRequest.onsuccess = () => {
      const metadata = metadataRequest.result;
      if (!metadata) return done(null);
      const request = tx.objectStore('contents').get(id);
      request.onsuccess = () => {
        if (!request.result) return done(null);
        const updated = { ...metadata, openedAt: Date.now() };
        tx.objectStore('recents').put(updated);
        done({ metadata: updated, content: request.result.content });
      };
    };
  });
}

export function removeRecentOutput(id) {
  return transaction('readwrite', tx => {
    tx.objectStore('recents').delete(id);
    tx.objectStore('contents').delete(id);
  });
}
