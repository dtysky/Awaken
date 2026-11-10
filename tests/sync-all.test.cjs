const {test} = require('node:test');
const assert = require('node:assert/strict');
const {fixture, book, config, note} = require('./helpers.cjs');

test('sync all covers every shelf, merges remote notes and progress, and downloads only missing EPUBs', async () => {
  const f = fixture();
  const a = book('a'), b = book('b', {bookshelf: {value: 'Another shelf', ts: 10}}), c = book('c');
  const removed = book('d', {removed: true});
  f.seed(a, config({notes: [note(10)]})); f.seed(c);
  f.seedRemote(a, config({ts: 50, lastProgress: 75, notes: [note(30)]}));
  f.seedRemote(b, config({notes: [note(40)]}));
  f.remote.set('Awaken/books.json', JSON.stringify([a, b, removed]));
  f.dav._client = f.client;
  const get = f.client.getFileContents, downloads = [], progress = [], phases = [];
  f.client.getFileContents = async (path, options) => {
    if (path.endsWith('.epub')) downloads.push(path);
    return get(path, options);
  };
  f.dav.subscribe(state => phases.push(state.phase));
  const books = [a, c];
  await f.dav.syncAllBooks(books, message => progress.push(message));
  assert.equal(books.length, 4);
  assert.deepEqual(downloads, [`Awaken/${b.hash}/${b.name}.epub`]);
  assert.equal(await f.dav.isDownloaded(b), true);
  assert.ok(f.puts.some(put => put.path === `Awaken/${c.hash}/${c.name}.epub`));
  assert.equal(await f.dav.isDownloaded(removed), false);
  const local = JSON.parse(f.files.get(`${a.hash}/config.json`));
  const remote = JSON.parse(f.remote.get(`Awaken/${a.hash}/config.json`));
  assert.deepEqual(local.notes.map(item => item.page), [10, 30]);
  assert.deepEqual(remote.notes.map(item => item.page), [10, 30]);
  assert.equal(local.lastProgress, 75);
  assert.equal(f.dav.syncState.phase, 'synced');
  assert.equal(f.dav.syncState.allBooksPending, false);
  assert.equal(phases.filter(phase => phase === 'synced').length, 1);
  assert.ok(progress.some(message => message.startsWith('[3/3]')));
});

test('a failed download keeps successful books, continues the batch, and survives restart for retry', async () => {
  const f = fixture(); const a = book('a'), b = book('b'), c = book('c');
  for (const item of [a, b, c]) f.seedRemote(item);
  f.seed(c);
  f.remote.set('Awaken/books.json', JSON.stringify([a, b, c])); f.dav._client = f.client;
  const get = f.client.getFileContents, downloads = [];
  let offline = true;
  f.client.getFileContents = async (path, options) => {
    if (path.endsWith('.epub')) {
      downloads.push(path);
      if (offline && path.includes(a.hash)) throw new Error('Temporary download failure');
    }
    return get(path, options);
  };
  const books = [c];
  await assert.rejects(f.dav.syncAllBooks(books), /成功 2\/3 本/);
  assert.equal(f.dav.syncState.phase, 'error');
  assert.equal(f.dav.syncState.lastSync, undefined);
  assert.equal(f.dav.syncState.allBooksPending, true);
  assert.equal(await f.dav.isDownloaded(a), false);
  assert.equal(await f.dav.isDownloaded(b), true);
  const restarted = new f.WebDAV(); await restarted.initialize(); restarted._client = f.client;
  assert.equal(restarted.syncState.allBooksPending, true);
  // A normal index sync must not silently mark the interrupted full sync done.
  await restarted.syncBooks(books);
  assert.equal(restarted.syncState.allBooksPending, true);
  assert.equal(restarted.syncState.phase, 'pending');
  offline = false;
  await restarted.syncAllBooks(books);
  assert.equal(await restarted.isDownloaded(a), true);
  assert.equal(restarted.syncState.allBooksPending, false);
  assert.equal(restarted.syncState.phase, 'synced');
  assert.equal(downloads.filter(path => path.includes(a.hash)).length, 2);
  assert.equal(downloads.filter(path => path.includes(b.hash)).length, 1);
  assert.equal(downloads.filter(path => path.includes(c.hash)).length, 0);
});

test('a book config failure does not prevent other books from being synced and cached', async () => {
  const f = fixture(); const a = book('a'), b = book('b');
  f.seed(a); f.seedRemote(a); f.seedRemote(b);
  f.remote.set(`Awaken/${a.hash}/config.json`, '{broken');
  f.remote.set('Awaken/books.json', JSON.stringify([a, b])); f.dav._client = f.client;
  await assert.rejects(f.dav.syncAllBooks([a]), /成功 1\/2 本/);
  assert.equal(await f.dav.isDownloaded(b), true);
  assert.equal(JSON.parse(f.files.get(`${a.hash}/config.json`)).progress, 5);
});

test('full sync requires a connection and handles an empty library', async () => {
  const f = fixture();
  await assert.rejects(f.dav.syncAllBooks([]), /连接 WebDAV/);
  assert.equal(f.dav.syncState.phase, 'error');
  f.dav._client = f.client;
  await f.dav.syncAllBooks([]);
  assert.equal(f.dav.syncState.bookCount, 0);
  assert.equal(f.dav.syncState.allBooksPending, false);
  assert.equal(f.dav.syncState.phase, 'synced');
});
