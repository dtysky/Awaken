const {test} = require('node:test');
const assert = require('node:assert/strict');
const {load} = require('./helpers.cjs');

test('desktop request log persists concurrent entries in order and retains only the last 500', async () => {
  let content = Array.from({length: 500}, (_, i) => JSON.stringify({previous: i})).join('\n') + '\n';
  let creates = 0;
  const {logWebDAV} = load('src/backend/desktop/log.ts', {'@tauri-apps/api': {
    path: {async logDir() {return '/logs/Awaken';}},
    fs: {BaseDirectory: {Log: 2},
      async createDir(dir) {assert.equal(dir, '/logs/Awaken'); creates++;},
      async exists() {return true;}, async readTextFile() {return content;},
      async writeTextFile(filename, text, options) {
        assert.equal(filename, 'webdav.log'); assert.equal(options.dir, 2);
        await new Promise(resolve => setImmediate(resolve)); content = text;
      }
    }
  }});
  await Promise.all([logWebDAV({method: 'PUT', url: 'https://dav.invalid/book.epub', status: 400, durationMs: 10, error: 'Bad Request'}),
    logWebDAV({method: 'GET', url: 'https://dav.invalid/books.json', status: 200, durationMs: 20})]);
  const lines = content.trim().split('\n').map(JSON.parse);
  assert.equal(creates, 1);
  assert.equal(lines.length, 500);
  assert.equal(lines[0].previous, 2);
  assert.equal(lines[498].method, 'PUT');
  assert.equal(lines[499].method, 'GET');
  assert.ok(Number.isFinite(Date.parse(lines[499].time)));
});

test('an unwritable log directory never prevents synchronization and retries logging later', async () => {
  let attempts = 0, warnings = 0;
  const {logWebDAV} = load('src/backend/desktop/log.ts', {'@tauri-apps/api': {
    path: {async logDir() {return '/logs';}},
    fs: {BaseDirectory: {Log: 2}, async createDir() {attempts++; throw new Error('Read-only filesystem');}}
  }}, {console: {warn() {warnings++;}}});
  await logWebDAV({method: 'PUT', url: 'https://dav.invalid/book.epub', status: 200, durationMs: 1});
  await logWebDAV({method: 'GET', url: 'https://dav.invalid/book.epub', status: 200, durationMs: 1});
  assert.equal(attempts, 2); assert.equal(warnings, 2);
});
