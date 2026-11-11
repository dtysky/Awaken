const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {v2: webdav} = require('webdav-server');
const {createClient, getPatcher} = require('webdav');
const {fixture, book, config, note} = require('./helpers.cjs');
const {transport} = require('./transport.cjs');

test('real WebDAV HTTP round trip preserves remote books and uploads pending notes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'awaken-dav-test-'));
  const a = book('a'), b = book('b');
  for (const item of [a, b]) {
    const dir = path.join(root, 'Awaken', item.hash);
    await fs.mkdir(dir, {recursive: true});
    await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify(config()));
    await fs.writeFile(path.join(dir, item.name + '.epub'), Buffer.from('fixture'));
  }
  await fs.writeFile(path.join(root, 'Awaken', 'books.json'), JSON.stringify([a, b]));
  const server = new webdav.WebDAVServer({port: 0, hostname: '127.0.0.1', rootFileSystem: new webdav.PhysicalFileSystem(root)});
  let httpServer;
  try {
    httpServer = await new Promise(resolve => server.start(resolve));
    const f = fixture(); f.seed(a);
    f.dav._client = createClient(`http://127.0.0.1:${httpServer.address().port}`);
    await f.dav.saveConfig(a, config({notes: [note(20)]}));
    const books = await f.dav.syncBooks([a]);
    assert.equal(books.length, 2);
    assert.equal(f.dav.syncState.phase, 'synced');
    const remote = JSON.parse(await fs.readFile(path.join(root, 'Awaken', a.hash, 'config.json'), 'utf8'));
    assert.equal(remote.notes.length, 1);
  } finally {
    if (httpServer) await new Promise(resolve => httpServer.close(resolve));
    await fs.rm(root, {recursive: true, force: true});
  }
});

for (const direct of [false, true]) {
  test(`Mac bridge syncs covers and downloads EPUBs with ${direct ? 'direct library' : 'parent'} URL`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'awaken-bridge-test-'));
    const item = book('a', {name: '书名 含空格'});
    const library = path.join(root, 'Awaken');
    const dir = path.join(library, item.hash);
    const cover = Buffer.from([137, 80, 78, 71, 0, 128, 255]);
    const epub = Buffer.from([80, 75, 3, 4, 0, 128, 255]);
    await fs.mkdir(dir, {recursive: true});
    await fs.mkdir(path.join(library, 'Awaken'));
    await fs.writeFile(path.join(library, 'Awaken', 'books.json'), '[]');
    await fs.writeFile(path.join(library, 'books.json'), JSON.stringify([item]));
    await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify(config()));
    await fs.writeFile(path.join(dir, 'cover.png'), cover);
    await fs.writeFile(path.join(dir, item.name + '.epub'), epub);
    const server = new webdav.WebDAVServer({port: 0, hostname: '127.0.0.1', rootFileSystem: new webdav.PhysicalFileSystem(root)});
    let httpServer;
    try {
      httpServer = await new Promise(resolve => server.start(resolve));
      const bridge = transport();
      getPatcher().patch('request', bridge.request);
      const f = fixture(createClient, bridge.DAV_PREFIX);
      const url = `http://127.0.0.1:${httpServer.address().port}/${direct ? 'Awaken/' : ''}`;
      await f.dav.changeRemote({url, user: '', password: ''});
      const books = await f.dav.syncBooks([]);
      assert.equal(books.length, 1);
      assert.equal(f.dav.syncState.bookCount, 1);
      assert.equal(f.dav.syncState.phase, 'synced');
      assert.deepEqual(Buffer.from(f.files.get(`${item.hash}/cover.png`)), cover);
      assert.equal(await f.dav.isDownloaded(item), false);
      await f.dav.checkAndDownloadBook(item);
      assert.deepEqual(Buffer.from(f.files.get(`${item.hash}/${item.name}.epub`)), epub);
      assert.equal(await f.dav.isDownloaded(item), true);
      const check = bridge.requests.find(request => request.method === 'PROPFIND' && request.url.endsWith('/cover.png'));
      assert.equal(check.responseType, 2);
      assert.equal(await fs.readFile(path.join(library, 'Awaken', 'books.json'), 'utf8'), '[]');
    } finally {
      getPatcher().patch('request', options => require('axios')(options));
      if (httpServer) await new Promise(resolve => httpServer.close(resolve));
      await fs.rm(root, {recursive: true, force: true});
    }
  });
}

test('Mac bridge full sync uploads local EPUBs and downloads every remote shelf with current notes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'awaken-sync-all-'));
  const library = path.join(root, 'Awaken');
  const a = book('a'), b = book('b', {bookshelf: {value: '其他书架', ts: 10}}), c = book('c');
  const bytes = Buffer.from([80, 75, 0, 128, 255, 42]);
  for (const item of [a, b]) {
    const dir = path.join(library, item.hash);
    await fs.mkdir(dir, {recursive: true});
    await fs.writeFile(path.join(dir, 'config.json'), JSON.stringify(config({ts: 100, lastProgress: 90, notes: [note(30)]})));
    await fs.writeFile(path.join(dir, item.name + '.epub'), bytes);
  }
  await fs.writeFile(path.join(library, 'books.json'), JSON.stringify([a, b]));
  const server = new webdav.WebDAVServer({port: 0, hostname: '127.0.0.1', rootFileSystem: new webdav.PhysicalFileSystem(root)});
  let httpServer;
  try {
    httpServer = await new Promise(resolve => server.start(resolve));
    const bridge = transport(); getPatcher().patch('request', bridge.request);
    const f = fixture(createClient, bridge.DAV_PREFIX);
    f.seed(a, config({notes: [note(10)]})); f.seed(c);
    await f.dav.changeRemote({url: `http://127.0.0.1:${httpServer.address().port}/Awaken`, user: '', password: ''});
    const books = [a, c];
    await f.dav.syncAllBooks(books);
    assert.equal(books.length, 3);
    for (const item of books) assert.equal(await f.dav.isDownloaded(item), true);
    assert.deepEqual(Buffer.from(f.files.get(`${b.hash}/${b.name}.epub`)), bytes);
    assert.equal((await fs.readFile(path.join(library, c.hash, c.name + '.epub'))).length, 8);
    assert.equal(JSON.parse(f.files.get(`${a.hash}/config.json`)).lastProgress, 90);
    assert.equal(JSON.parse(await fs.readFile(path.join(library, a.hash, 'config.json'), 'utf8')).notes.length, 2);
    assert.equal(f.dav.syncState.phase, 'synced');
    assert.equal(bridge.requests.filter(request => request.method === 'GET' && request.url.endsWith('.epub')).length, 1);
    await f.dav.syncAllBooks(books);
    assert.equal(bridge.requests.filter(request => request.method === 'GET' && request.url.endsWith('.epub')).length, 1);
  } finally {
    getPatcher().patch('request', options => require('axios')(options));
    if (httpServer) await new Promise(resolve => httpServer.close(resolve));
    await fs.rm(root, {recursive: true, force: true});
  }
});

test('Mac bridge exposes HTTP 400 details and syncs a colon title through a strict WebDAV server', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'awaken-filename-test-'));
  const library = path.join(root, 'Awaken');
  await fs.mkdir(library);
  await fs.writeFile(path.join(library, 'books.json'), '[]');
  const server = new webdav.WebDAVServer({port: 0, hostname: '127.0.0.1', rootFileSystem: new webdav.PhysicalFileSystem(root)});
  server.beforeRequest((ctx, next) => {
    if (!decodeURIComponent(ctx.request.url).includes(':')) return next();
    ctx.setCode(400);
    ctx.response.setHeader('Content-Type', 'application/xml');
    ctx.response.write('<d:error xmlns:d="DAV:" xmlns:s="urn:server"><s:message>the nustore path is not valid</s:message></d:error>');
    ctx.exit();
  });
  let httpServer;
  try {
    httpServer = await new Promise(resolve => server.start(resolve));
    const url = `http://127.0.0.1:${httpServer.address().port}/Awaken`;
    const bridge = transport(); getPatcher().patch('request', bridge.request);
    const item = book('a', {name: '于天上看见深渊:新经典主义文学对话录'});
    const client = createClient(bridge.DAV_PREFIX + url);
    await assert.rejects(client.exists(`${item.hash}/${item.name}.epub`),
      /400 Bad Request: the nustore path is not valid/);
    assert.equal(bridge.logs[0].status, 400);
    assert.match(bridge.logs[0].error, /path is not valid/);
    const f = fixture(createClient, bridge.DAV_PREFIX); f.seed(item);
    await f.dav.changeRemote({url, user: '', password: ''});
    const books = [item];
    await f.dav.syncAllBooks(books);
    const remote = JSON.parse(await fs.readFile(path.join(library, 'books.json'), 'utf8'));
    assert.equal(remote[0].name, item.name);
    assert.equal(remote[0].remoteFile, 'book.epub');
    assert.equal((await fs.readFile(path.join(library, item.hash, 'book.epub'))).length, 8);
    const second = fixture(createClient, bridge.DAV_PREFIX);
    await second.dav.changeRemote({url, user: '', password: ''});
    const downloaded = [];
    await second.dav.syncAllBooks(downloaded);
    assert.equal(await second.dav.isDownloaded(downloaded[0]), true);
    assert.deepEqual(Buffer.from(second.files.get(`${item.hash}/${item.name}.epub`)), Buffer.alloc(8));
    assert.equal(bridge.logs.filter(entry => entry.status === 400).length, 1);
  } finally {
    getPatcher().patch('request', options => require('axios')(options));
    if (httpServer) await new Promise(resolve => httpServer.close(resolve));
    await fs.rm(root, {recursive: true, force: true});
  }
});
