// Production WebKit UI with real generated EPUBs and isolated native API fixtures.
// No user files or external servers are accessed.
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const md5 = require('js-md5');
const playwright = require(process.env.AWAKEN_PLAYWRIGHT_MODULE || 'playwright-core');

async function epub(title, repack = false) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('book.opf', `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">fixture-${title}</dc:identifier><dc:title>${title}</dc:title><dc:creator>测试作者</dc:creator><dc:language>zh</dc:language></metadata>${repack ? '<!-- repackaged -->' : ''}<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="text" href="text.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="text"/></spine></package>`);
  zip.file('nav.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><ol><li><a href="text.xhtml">第一章</a></li></ol></nav></body></html>');
  zip.file('text.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第一章</title></head><body><p>测试正文。</p></body></html>');
  return [...await zip.generateAsync({type: 'uint8array', compression: repack ? 'DEFLATE' : 'STORE'})];
}

(async () => {
  const original = await epub('重复导入测试'), repacked = await epub('重复导入测试', true), fresh = await epub('新书测试');
  const originalHash = md5.hex(original);
  assert.notEqual(originalHash, md5.hex(repacked));
  const root = path.resolve(__dirname, '../dist');
  const server = http.createServer(async (req, res) => {
    try {
      const name = req.url === '/' ? 'index.html' : req.url.slice(1);
      if (name.includes('..')) {res.writeHead(404); res.end(); return;}
      res.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(await fs.readFile(path.join(root, name)));
    } catch {res.writeHead(404); res.end();}
  });
  let browser, deadline;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await playwright.webkit.launch({headless: true});
    deadline = setTimeout(() => {console.error('Import browser test exceeded 60 seconds'); browser.close();}, 60000);
    for (const width of [900, 390]) {
      const page = await browser.newPage({viewport: {width, height: 740}});
      page.setDefaultTimeout(8000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(({original, repacked, fresh, originalHash}) => {
        const cfg = {ts: 10, progress: 45, lastProgress: 45, notes: [{cfi: 'original-note', annotation: '原笔记'}], bookmarks: []};
        const books = [{hash: originalHash, type: 'EPUB', name: '重复导入测试', author: '测试作者', ts: 10, bookshelf: {value: '文学', ts: 10}},
          {hash: 'b'.repeat(32), type: 'EPUB', name: '书架测试', author: '测试作者', ts: 10}];
        const initial = {'/library/books.json': JSON.stringify(books), settings: JSON.stringify({folder: '/library', webDav: {url: '', user: '', password: ''}, read: {}})};
        for (const book of books) {
          initial[`/library/${book.hash}/config.json`] = JSON.stringify(cfg);
          initial[`/library/${book.hash}/${book.name}.epub`] = original;
          initial[`/library/${book.hash}`] = null;
        }
        window.fixtureFiles = JSON.parse(localStorage.getItem('import-fixture') || 'null') || initial;
        window.fixtureRemote = window.fixtureFiles['/library/books.json'];
        window.fixtureRequests = [];
        window.fixtureSelection = ['exact.epub', 'repacked.epub', 'new.epub'];
        const inputs = {'exact.epub': original, 'repacked.epub': repacked, 'new.epub': fresh};
        window.__TAURI_IPC__ = request => {
          const m = request.message, files = window.fixtureFiles;
          let value;
          const key = m.path === 'settings.json' ? 'settings' : m.options?.dir === 19 ? '/logs/' + m.path : m.path;
          if (request.__tauriModule === 'Dialog' && m.cmd === 'openDialog') value = window.fixtureSelection;
          else if (request.__tauriModule === 'Path') value = '/logs';
          else if (request.__tauriModule === 'Http' && m.cmd === 'createClient') value = 1;
          else if (request.__tauriModule === 'Http' && m.cmd === 'httpRequest') {
            const {url, method, body} = m.options;
            window.fixtureRequests.push({method, url});
            let status = 404, data = '';
            if (url.endsWith('/books.json') && method === 'GET') {status = 200; data = window.fixtureRemote;}
            else if (url.endsWith('/books.json') && method === 'PUT') {
              if (window.fixturePutFails) {status = 403; data = '<error><message>permission denied</message></error>';}
              else {status = 204; window.fixtureRemote = body.payload;}
            } else if (method !== 'PROPFIND') {window['_' + request.error]('Unexpected request ' + method + ' ' + url); return;}
            value = {url, status, data, headers: {}, rawHeaders: {}};
          } else if (request.__tauriModule === 'Fs') {
            if (m.cmd === 'exists') value = Object.hasOwn(files, key);
            else if (m.cmd === 'readTextFile') value = files[key];
            else if (m.cmd === 'readFile') value = inputs[key];
            else if (m.cmd === 'createDir') files[key] = null;
            else if (m.cmd === 'writeFile') files[key] = key.includes('.epub') ? m.contents : new TextDecoder().decode(new Uint8Array(m.contents));
            else if (m.cmd === 'renameFile') {files[m.newPath] = files[m.oldPath]; delete files[m.oldPath]; localStorage.setItem('import-fixture', JSON.stringify(files));}
            else {window['_' + request.error]('Unexpected file operation ' + m.cmd); return;}
          } else {window['_' + request.error]('Unexpected native call ' + request.__tauriModule + ' ' + m.cmd); return;}
          window['_' + request.callback](value);
        };
        const fetch = window.fetch;
        window.fetch = (input, options) => {
          if (String(input).startsWith('asset:')) {
            const key = decodeURIComponent(String(input).slice('asset://'.length));
            const value = window.fixtureFiles[key];
            return Promise.resolve(new Response(Array.isArray(value) ? new Uint8Array(value) : value, {status: value === undefined ? 404 : 200}));
          }
          return fetch(input, options);
        };
      }, {original, repacked, fresh, originalHash});
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const originalConfig = await page.evaluate(hash => window.fixtureFiles[`/library/${hash}/config.json`], originalHash);
      await page.getByText('添加', {exact: true}).click();
      const report = page.locator('.hana-modal-main').filter({hasText: '导入结果'});
      await report.getByText('已导入 1 本，跳过 1 本完全相同的文件。').waitFor();
      assert.equal(await report.getByRole('checkbox').isChecked(), false);
      assert.equal(await page.evaluate(() => JSON.parse(window.fixtureFiles['/library/books.json']).length), 3);
      await page.screenshot({path: path.join(os.tmpdir(), `awaken-import-${width}.png`), animations: 'disabled'});
      await report.getByRole('button', {name: '跳过重复项'}).click();
      await page.evaluate(() => {window.fixtureSelection = ['repacked.epub'];});
      await page.getByText('添加', {exact: true}).click();
      await report.getByRole('checkbox').check();
      await report.getByRole('button', {name: '导入选中的 1 本'}).click();
      await page.waitForFunction(() => JSON.parse(window.fixtureFiles['/library/books.json']).length === 4);
      await page.locator('.hana-loading-wrap').waitFor({state: 'hidden'});
      assert.equal(await page.evaluate(hash => window.fixtureFiles[`/library/${hash}/config.json`], originalHash), originalConfig);

      // Connect only to the isolated native HTTP fixture, then move a book.
      await page.evaluate(() => {
        const settings = JSON.parse(window.fixtureFiles.settings);
        settings.webDav.url = 'https://example.invalid/dav';
        window.fixtureFiles.settings = JSON.stringify(settings);
        localStorage.setItem('import-fixture', JSON.stringify(window.fixtureFiles));
      });
      await page.reload();
      await page.locator('.hana-modal-main').filter({hasText: '连接服务器并同步？'}).getByText('确认', {exact: true}).click();
      await page.locator('.hana-loading-wrap').waitFor({state: 'hidden'});
      const picker = page.getByRole('dialog', {name: '移入书架'});
      await page.getByRole('button', {name: '将《书架测试》移入书架'}).click();
      await picker.getByRole('button', {name: /^文学 /}).click();
      await picker.waitFor({state: 'hidden'});
      await page.locator('.hana-loading-wrap').waitFor({state: 'hidden'});
      await page.getByRole('button', {name: '查看书架'}).click();
      assert.ok(await page.evaluate(() => window.fixtureRequests.filter(r => r.method === 'PUT').length >= 2));
      await page.evaluate(() => {window.fixturePutFails = true;});
      await page.getByRole('button', {name: '将《书架测试》移入书架'}).click();
      await picker.getByRole('button', {name: /^默认书架/}).click();
      await picker.waitFor({state: 'hidden'});
      await page.locator('.hana-loading-wrap').waitFor({state: 'hidden'});
      await page.getByRole('button', {name: '重试同步'}).waitFor();
      await page.getByRole('button', {name: '查看书架'}).click();
      await page.getByRole('button', {name: '将《书架测试》移入书架'}).click();
      await picker.getByRole('button', {name: '取消', exact: true}).click();
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: real EPUB duplicate detection, explicit edition import, preserved notes; connected shelf moves release the loading overlay after success and HTTP failure`);
      await page.close();
    }
  } finally {
    clearTimeout(deadline);
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
