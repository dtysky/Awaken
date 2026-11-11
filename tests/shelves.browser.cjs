// Run against `npm run build` output. Uses an isolated, in-browser Tauri file
// fixture; neither the user's library nor the real WebDAV service is accessed.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const playwright = require(process.env.AWAKEN_PLAYWRIGHT_MODULE || 'playwright-core');

(async () => {
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
    browser = process.env.AWAKEN_CHROMIUM_PATH ?
      await playwright.chromium.launch({headless: true, executablePath: process.env.AWAKEN_CHROMIUM_PATH}) :
      await playwright.webkit.launch({headless: true});
    deadline = setTimeout(() => {console.error('Shelf UI test exceeded 60 seconds'); browser.close();}, 60000);
    for (const width of [900, 390]) {
      const page = await browser.newPage({viewport: {width, height: 740}});
      page.setDefaultTimeout(8000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        const shelves = [null, null, '文学', '世界文学', '历史', ...Array.from({length: 12}, (_, i) => '专题书架 ' + (i + 1))];
        const books = shelves.map((shelf, i) => ({hash: (i + 1).toString(16).padStart(32, '0'), type: 'EPUB',
          name: i === 0 ? '苏菲的世界' : i === 1 ? '人类群星闪耀时' : '书籍 ' + (i + 1), author: '测试作者', ts: 10,
          ...(shelf ? {bookshelf: {value: shelf, ts: 10}} : {})}));
        const initial = {'/library/books.json': JSON.stringify(books), settings: JSON.stringify({folder: '/library', webDav: {url: '', user: '', password: ''}, read: {}})};
        books.forEach(book => {initial[`/library/${book.hash}/${book.name}.epub`] = 'EPUB fixture';});
        window.fixtureFiles = JSON.parse(localStorage.getItem('shelf-fixture') || 'null') || initial;
        window.fixtureBook = () => JSON.parse(window.fixtureFiles['/library/books.json'])[0];
        window.__TAURI_IPC__ = request => {
          const m = request.message, files = window.fixtureFiles;
          let value;
          const key = m.path === 'settings.json' ? 'settings' : m.path;
          if (request.__tauriModule !== 'Fs') {window['_' + request.error]('Unexpected module ' + request.__tauriModule); return;}
          if (m.cmd === 'exists') value = Object.hasOwn(files, key);
          else if (m.cmd === 'readTextFile') value = files[key];
          else if (m.cmd === 'writeFile') {
            if (window.fixtureDiskFull) {window['_' + request.error]('磁盘空间不足'); return;}
            files[key] = new TextDecoder().decode(new Uint8Array(m.contents));
          } else if (m.cmd === 'renameFile') {
            files[m.newPath] = files[m.oldPath]; delete files[m.oldPath];
            localStorage.setItem('shelf-fixture', JSON.stringify(files));
          } else {window['_' + request.error]('Unexpected command ' + m.cmd); return;}
          window['_' + request.callback](value);
        };
        const originalFetch = window.fetch;
        window.fetch = (input, options) => {
          if (String(input).startsWith('asset:')) {
            const name = decodeURIComponent(String(input).replace(/^asset:\/\/(?:localhost\/)?/, '')).replace(/^\/+/, '/');
            return Promise.resolve(new Response(window.fixtureFiles[name] || '', {status: Object.hasOwn(window.fixtureFiles, name) ? 200 : 404}));
          }
          return originalFetch(input, options);
        };
      });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      const openPicker = async () => {
        try { await page.getByRole('button', {name: '将《苏菲的世界》移入书架', exact: true}).click(); }
        catch (error) {console.error(await page.locator('body').innerText()); throw error;}
        await page.getByRole('dialog', {name: '移入书架'}).waitFor();
      };
      const dialog = page.getByRole('dialog', {name: '移入书架'});
      const search = dialog.getByLabel('搜索或新建书架');
      await openPicker();
      assert.equal(await search.evaluate(input => document.activeElement === input), true);
      assert.equal(await dialog.getByRole('button', {name: /^默认书架/}).isDisabled(), true);
      const bounds = await dialog.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= 740);
      await page.screenshot({path: path.join(os.tmpdir(), `awaken-shelves-${width}.png`)});

      await search.fill('文学');
      assert.equal(await dialog.getByRole('button', {name: /^历史/}).count(), 0);
      await dialog.getByRole('button', {name: /^文学 /}).click();
      await dialog.waitFor({state: 'hidden'});
      assert.equal(await page.evaluate(() => window.fixtureBook().bookshelf.value), '文学');
      await page.getByRole('button', {name: '查看书架'}).click();
      await openPicker();
      await search.fill('  哲学与思考  ');
      await dialog.getByRole('button', {name: '新建“哲学与思考”并移入'}).waitFor();
      await page.screenshot({path: path.join(os.tmpdir(), `awaken-shelves-create-${width}.png`)});
      await search.press('Enter');
      await dialog.waitFor({state: 'hidden'});
      assert.equal(await page.evaluate(() => window.fixtureBook().bookshelf.value), '哲学与思考');

      await page.reload();
      try { await page.getByText('书架', {exact: true}).click(); }
      catch (error) {console.error('After reload:', await page.locator('body').innerText(), errors); throw error;}
      await page.getByRole('button', {name: '哲学与思考', exact: true}).click();
      await openPicker();
      assert.equal(await search.inputValue(), '');
      await dialog.getByRole('button', {name: /^默认书架/}).click();
      await dialog.waitFor({state: 'hidden'});
      await page.getByRole('button', {name: '查看书架'}).click();

      await openPicker();
      await search.fill('不要创建');
      await search.press('Escape');
      await dialog.waitFor({state: 'hidden'});
      assert.equal(await page.getByRole('button', {name: '将《苏菲的世界》移入书架'}).evaluate(button => document.activeElement === button), true);
      await openPicker();
      assert.equal(await search.inputValue(), '');
      await page.evaluate(() => {window.fixtureDiskFull = true;});
      await dialog.getByRole('button', {name: /^历史 /}).click();
      await dialog.getByRole('alert').waitFor();
      assert.equal(await dialog.getByRole('alert').innerText(), '磁盘空间不足');
      assert.equal(await page.evaluate(() => window.fixtureBook().bookshelf.value), null);
      await page.evaluate(() => {window.fixtureDiskFull = false;});
      await dialog.getByRole('button', {name: /^历史 /}).click();
      await dialog.waitFor({state: 'hidden'});
      assert.equal(await page.evaluate(() => window.fixtureBook().bookshelf.value), '历史');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: one-click move, inline creation, reload persistence, return to default, cancel/reset/focus, disk failure and retry`);
      await page.close();
    }
  } finally {
    clearTimeout(deadline);
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
