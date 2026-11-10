const {test} = require('node:test');
const assert = require('node:assert/strict');
const {load, clone, hash, book, note, config, fixture} = require('./helpers.cjs');
const common = load('src/frontend/reader/common.ts');
const {mergeBooks, mergeConfig, validateBooks} = load('src/frontend/sync.ts');

test('inserting a highlight between existing notes preserves both neighbors', () => {
  const notes = [note(10), note(30)];
  const n = note(20);
  common.changeNote(notes, n, common.checkNoteMark(notes, n.start, n.end), common.ENoteAction.Add);
  assert.deepEqual(notes.map(n => n.page), [10, 20, 30]);
});
test('adding before the first bookmark and reviving a tombstone preserve unrelated records', () => {
  const notes = [note(10, {removed: 20}), note(30)];
  const n = note(10, {modified: 30});
  common.changeNote(notes, n, {exist: false, index: 0}, common.ENoteAction.Add);
  assert.deepEqual(notes.map(n => n.page), [10, 30]);
  common.changeNote(notes, note(5), {exist: false, index: 0}, common.ENoteAction.Add);
  assert.deepEqual(notes.map(n => n.page), [5, 10, 30]);
});
test('offline book additions and deletions persist the index and pending state across restart', async () => {
  const {dav, WebDAV, files} = fixture();
  files.set('input.epub', new ArrayBuffer(8));
  const books = [];
  await dav.addBook('input.epub', books);
  assert.equal(JSON.parse(files.get('books.json')).length, 1);
  assert.equal(JSON.parse(files.get('sync-state.json')).phase, 'pending');
  await dav.removeBook(books[0], books);
  assert.equal(JSON.parse(files.get('books.json'))[0].removed, true);
  const restarted = new WebDAV();
  await restarted.initialize();
  assert.equal(restarted.syncState.phase, 'pending');
  assert.ok(restarted.syncState.libraryPending);
});
test('shelf merge preserves remote-only books and uses the shelf timestamp', async () => {
  const f = fixture();
  const a = book('a', {bookshelf: {value: 'Older', ts: 20}});
  const remoteA = book('a', {bookshelf: {value: null, ts: 30}});
  const b = book('b');
  f.seed(a); f.seedRemote(remoteA); f.seedRemote(b);
  f.remote.set('Awaken/books.json', JSON.stringify([remoteA, b]));
  f.dav._client = f.client;
  const local = [a];
  await f.dav.syncBookshelf(local);
  const result = JSON.parse(f.remote.get('Awaken/books.json'));
  assert.equal(result.length, 2);
  assert.equal(result[0].bookshelf.value, null);
  assert.equal(local.length, 2);
});
test('library updates retry conditional-write conflicts without dropping concurrent books', async () => {
  const f = fixture();
  const a = book('a'), b = book('b');
  f.seed(a); f.seedRemote(a); f.seedRemote(b);
  f.remote.set('Awaken/books.json', JSON.stringify([a]));
  f.dav._client = f.client;
  const put = f.client.putFileContents;
  let raced = false;
  f.client.putFileContents = async (path, data, options) => {
    if (path === 'Awaken/books.json' && !raced) {
      raced = true;
      f.remote.set(path, JSON.stringify([a, b])); f.etags.set(path, 2);
    }
    return put(path, data, options);
  };
  await f.dav.syncBooks([a]);
  assert.equal(JSON.parse(f.remote.get('Awaken/books.json')).length, 2);
  assert.ok(f.puts.find(p => p.path === 'Awaken/books.json').options.headers['If-Match']);
});
test('cached books stay readable when a formerly connected server is unavailable', async () => {
  const f = fixture(); const a = book(); f.seed(a, config({notes: [note(20)]}));
  f.client.getFileContents = async () => {throw new Error('Offline');}; f.dav._client = f.client;
  const loaded = await f.dav.loadBook(a);
  assert.equal(loaded.config.notes.length, 1);
  assert.equal(loaded.content.byteLength, 8);
  assert.equal(f.dav.syncState.phase, 'error');
});
test('failed uploads preserve pending changes; retry syncs them and records last success', async () => {
  const f = fixture(); const a = book(); f.seed(a); f.seedRemote(a);
  f.remote.set('Awaken/books.json', JSON.stringify([a])); f.dav._client = f.client;
  await f.dav.saveConfig(a, config({notes: [note(20)]}));
  const put = f.client.putFileContents;
  f.client.putFileContents = async () => {throw new Error('Disconnected');};
  await assert.rejects(f.dav.syncBooks([a]), /Disconnected/);
  assert.ok(f.dav.syncState.pendingBooks[a.hash]);
  f.client.putFileContents = put;
  await f.dav.syncBooks([a]);
  assert.equal(JSON.parse(f.remote.get(`Awaken/${a.hash}/config.json`)).notes.length, 1);
  assert.equal(f.dav.syncState.phase, 'synced');
  assert.ok(f.dav.syncState.lastSync);
  const restarted = new f.WebDAV(); await restarted.initialize();
  assert.equal(restarted.syncState.lastSync, f.dav.syncState.lastSync);
});
test('note deletion tombstones survive repeated merges and progress zero is retained', () => {
  const local = config({progress: 0, lastProgress: 0, ts: 30, notes: [note(10, {removed: 25})]});
  const remote = config({notes: [note(10), note(30)]});
  const merged = mergeConfig(local, remote);
  assert.equal(merged.notes.length, 1);
  assert.equal(merged.lastProgress, 0);
  assert.equal(mergeConfig(merged, remote).notes.length, 1);
  assert.equal(merged.removedTs[note(10).cfi], 25);
});
test('a local edit made while a note upload is in flight remains pending and is not overwritten', async () => {
  const f = fixture(); const a = book(); f.seed(a); f.seedRemote(a); f.dav._client = f.client;
  await f.dav.saveConfig(a, config({notes: [note(10)]}));
  const put = f.client.putFileContents;
  let edited = false;
  f.client.putFileContents = async (...args) => {
    if (!edited) { edited = true; await f.dav.saveConfig(a, config({notes: [note(10), note(30)]})); }
    return put(...args);
  };
  const result = await f.dav.syncBook(a);
  assert.equal(result.notes.length, 2);
  assert.ok(f.dav.syncState.pendingBooks[a.hash]);
});
test('downloaded books require no network; requested downloads persist their contents', async () => {
  const f = fixture(); const a = book(); f.seed(a);
  assert.equal(await f.dav.isDownloaded(a), true);
  await f.dav.checkAndDownloadBook(a);
  f.files.delete(`${a.hash}/${a.name}.epub`);
  await assert.rejects(f.dav.checkAndDownloadBook(a), /未下载/);
  f.seedRemote(a); f.dav._client = f.client;
  await f.dav.checkAndDownloadBook(a);
  assert.equal(await f.dav.isDownloaded(a), true);
});
test('malformed or traversing remote book indexes are rejected before file operations', () => {
  assert.throws(() => validateBooks([book('a', {name: '../settings'})]), /格式错误/);
  assert.throws(() => validateBooks([book('a', {hash: '../settings'})]), /格式错误/);
  assert.equal(validateBooks([book()]).length, 1);
});
test('corrupt local indexes are reported without overwriting the original file', async () => {
  const f = fixture(); f.files.set('books.json', '{broken');
  const utils = load('src/frontend/utils.tsx', {'../backend': {default: {worker: f.worker}}});
  await assert.rejects(utils.loadBooks());
  assert.equal(f.files.get('books.json'), '{broken');
});
test('Kindle highlights of six or fewer characters use their own length', async () => {
  const leaf = {textContent: '你好世界', childNodes: []};
  let end;
  const section = {async load() {}, document: {querySelector: () => leaf,
    createRange: () => ({setStart() {}, setEnd(node, offset) {end = offset;}})}, cfiFromRange: () => 'found'};
  const utils = load('src/frontend/utils.tsx', {'../backend': {default: {}}});
  const result = await utils.searchFirstInBook('你好', {spine: {spineItems: [section]}, load() {}}, 0);
  assert.equal(result.cfi, 'found'); assert.equal(end, 2);
});
test('iOS write promises wait for the native operation and propagate errors', async () => {
  let finish;
  const native = load('src/backend/native/index.ts', {'ajax-hook': {proxy() {}}, '../../interfaces': {}, './utils': {}, '../common': {}}, {
    window: {Awaken: {getPlatform: () => 'IOS'}}, fetch: () => new Promise(resolve => {finish = resolve;})
  });
  let done = false;
  const pending = native.worker.fs.writeFile('config.json', '{}', 'Books').then(() => {done = true;});
  await new Promise(resolve => setImmediate(resolve)); assert.equal(done, false);
  finish({headers: {get: () => null}}); await pending; assert.equal(done, true);
  const failed = native.worker.fs.writeFile('config.json', '{}', 'Books');
  finish({headers: {get: () => 'Disk full'}});
  await assert.rejects(failed, /Disk full/);
});
test('bookmark ranges preserve their chapter and split into valid point CFIs', () => {
  const a = 'epubcfi(/6/10[chapter-4]!/4/2/1:10)';
  const b = 'epubcfi(/6/10[chapter-4]!/4/2/1:25)';
  const range = common.mergeCFI(a, b);
  assert.ok(range.startsWith('epubcfi(/6/10[chapter-4]!'));
  assert.deepEqual(clone(common.splitCFI(range)), [a, b]);
  assert.deepEqual(clone(common.splitCFI(a)), [a, a]);
});

test('a URL pointing directly to a library uses its index instead of a nested empty library', async () => {
  const f = fixture(); const a = book();
  f.seedRemote(a);
  for (const [key, value] of [...f.remote]) {
    if (key !== 'Awaken/books.json') {f.remote.set(key.replace(/^Awaken\//, ''), value); f.remote.delete(key);}
  }
  f.remote.set('books.json', JSON.stringify([a]));
  await f.dav.changeRemote({url: 'https://example.invalid/dav/Awaken/', user: '', password: ''});
  assert.equal(f.puts.length, 0);
  const books = await f.dav.syncBooks([]);
  assert.equal(books.length, 1);
  assert.equal(f.remote.get('Awaken/books.json'), '[]');
  assert.equal(f.dav.syncState.bookCount, 1);
});

test('new libraries are created once for both parent and direct library URLs', async () => {
  for (const [url, index] of [['https://example.invalid/dav/', 'Awaken/books.json'],
    ['https://example.invalid/dav/Awaken/', 'books.json']]) {
    const f = fixture(); f.remote.clear();
    await f.dav.changeRemote({url, user: '', password: ''});
    assert.deepEqual(f.puts.map(item => item.path), [index]);
    await f.dav.changeRemote({url, user: '', password: ''});
    assert.equal(f.puts.length, 1);
  }
});

test('missing or corrupt remote indexes never silently replace an existing library with an empty one', async () => {
  for (const folder of ['', 'Awaken/']) {
    const f = fixture(); f.remote.clear(); f.remote.set(folder + hash('a'), null);
    if (folder) f.remote.set('Awaken', null);
    await assert.rejects(f.dav.changeRemote({url: 'https://example.invalid/dav/', user: '', password: ''}), /缺少 books.json/);
    assert.equal(f.puts.length, 0);
  }
  const f = fixture(); f.remote.set('books.json', '{broken');
  await assert.rejects(f.dav.changeRemote({url: 'https://example.invalid/dav/Awaken/', user: '', password: ''}));
  assert.equal(f.puts.length, 0);
  f.remote.clear(); f.dav._client = f.client;
  await assert.rejects(f.dav.syncBooks([]), /索引已丢失/);
  assert.equal(f.puts.length, 0);
});
