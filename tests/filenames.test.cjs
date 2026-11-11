const {test} = require('node:test');
const assert = require('node:assert/strict');
const {load, fixture, book} = require('./helpers.cjs');
const {safeRemoteEpubFile, mergeBooks, validateBooks} = load('src/frontend/sync.ts');

test('remote filenames support restricted WebDAV services without changing ordinary titles', () => {
  for (const name of ['于天上看见深渊:新经典主义文学对话录', 'a?b', 'a*b', 'a|b', 'a"b', 'a<b>',
    'a/b', 'a\\b', 'a\n', 'CON', 'con.txt', 'LPT1', '#book', '~book', ' book ', 'book.', '书'.repeat(80)]) {
    assert.equal(safeRemoteEpubFile(name), 'book.epub', name);
  }
  for (const name of ['普通 中文书名', 'The Secret Garden', '于天上看见深渊：文学对话录', 'CONTEXT']) {
    assert.equal(safeRemoteEpubFile(name), name + '.epub');
  }
});

test('remote filename metadata cannot traverse directories and survives older-client edits', () => {
  for (const remoteFile of ['../book.epub', 'a/b.epub', 'a\\b.epub', 'bad\0.epub', 'config.json', 42, null]) {
    assert.throws(() => validateBooks([book('a', {remoteFile})]), /格式错误/);
  }
  const mapped = book('a', {remoteFile: 'book.epub'});
  assert.equal(validateBooks([mapped]).length, 1);
  assert.equal(mergeBooks([book('a', {ts: 20})], [mapped])[0].remoteFile, 'book.epub');
  assert.equal(mergeBooks([mapped], [book('a', {ts: 20})])[0].remoteFile, 'book.epub');
});

test('special titles upload safely, retry after failure, download on another client, and delete the mapped file', async () => {
  const f = fixture();
  const item = book('a', {name: '于天上看见深渊:新经典主义文学对话录'});
  f.seed(item); f.dav._client = f.client;
  const originalPut = f.client.putFileContents;
  let fail = true;
  f.client.putFileContents = async (path, ...args) => {
    assert.ok(!path.includes(':'), 'no forbidden filename is sent to the server');
    if (fail && path.endsWith('book.epub')) throw new Error('Disconnected');
    return originalPut(path, ...args);
  };
  const books = [item];
  await f.dav.saveBooks(books);
  await assert.rejects(f.dav.syncAllBooks(books), /Disconnected/);
  assert.equal(JSON.parse(f.files.get('books.json'))[0].name, item.name);
  assert.ok(f.dav.syncState.libraryPending);
  assert.equal(f.remote.get('Awaken/books.json'), '[]');
  fail = false;
  await f.dav.syncAllBooks(books);
  assert.equal(books[0].name, item.name);
  assert.equal(books[0].remoteFile, 'book.epub');
  assert.equal(f.remote.get(`Awaken/${item.hash}/book.epub`).byteLength, 8);
  assert.equal(JSON.parse(f.remote.get('Awaken/books.json'))[0].remoteFile, 'book.epub');
  assert.ok(f.files.has(`${item.hash}/${item.name}.epub`));

  const second = fixture(); second.dav._client = f.client;
  const downloaded = [];
  await second.dav.syncAllBooks(downloaded);
  assert.equal(downloaded[0].name, item.name);
  assert.equal(await second.dav.isDownloaded(downloaded[0]), true);
  assert.equal(second.files.get(`${item.hash}/${item.name}.epub`).byteLength, 8);
  await second.dav.removeBook(downloaded[0], downloaded);
  await second.dav.syncBooks(downloaded);
  assert.equal(f.remote.has(`Awaken/${item.hash}/book.epub`), false);
  assert.equal(JSON.parse(f.remote.get('Awaken/books.json'))[0].removed, true);
});

test('legacy special-title files remain readable and metadata-only updates do not point at missing files', async () => {
  const f = fixture(); const item = book('a', {name: 'Legacy: title'});
  f.seed(item); f.files.delete(`${item.hash}/${item.name}.epub`);
  f.seedRemote(item); f.remote.set('Awaken/books.json', JSON.stringify([item])); f.dav._client = f.client;
  const books = [book('a', {...item, ts: 20})];
  await f.dav.syncBooks(books);
  assert.equal(books[0].remoteFile, undefined);
  await f.dav.checkAndDownloadBook(books[0]);
  assert.equal(await f.dav.isDownloaded(books[0]), true);
});

test('deleting a special-title book that was never uploaded does not probe its invalid remote path', async () => {
  const f = fixture(); const item = book('a', {name: 'Never: uploaded', removed: true});
  f.dav._client = f.client;
  const exists = f.client.exists;
  f.client.exists = async path => {assert.ok(!path.includes(':')); return exists(path);};
  await f.dav.syncBooks([item]);
  assert.equal(f.dav.syncState.phase, 'synced');
});
