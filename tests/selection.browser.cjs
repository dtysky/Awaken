// Optional WebKit integration test. Set AWAKEN_PLAYWRIGHT_MODULE to a local
// playwright-core installation and PLAYWRIGHT_BROWSERS_PATH to its browser cache.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const webpack = require('webpack');
const JSZip = require('jszip');
const playwright = require(process.env.AWAKEN_PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(__dirname, '..');

(async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'awaken-selection-'));
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('book.opf', `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">awaken-test</dc:identifier><dc:title>Selection regression</dc:title><dc:language>en</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>`);
  zip.file('nav.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="a.xhtml">Chapter A</a></li><li><a href="b.xhtml">Chapter B</a></li></ol></nav></body></html>');
  for (const chapter of ['a', 'b']) {
    zip.file(chapter + '.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><head><meta http-equiv="refresh" content="0; url=/escape.html"/><script>parent.testBookScript = true;</script><script src="data:text/javascript,parent.testExternalScript=true"></script><title>Chapter ${chapter}</title><style>body {font: 20px serif; line-height: 2;} p {margin: 1em 0;}</style></head><body onload="parent.testBookEvent = true"><p id="target" onclick="parent.testBookEvent = true">Selecting text should create a persistent highlight in chapter ${chapter}.</p><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><a xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="/escape.html" id="escape"><text x="0" y="10">Link</text></a></svg>${'<p>More reading text to exercise pagination and selection on later pages.</p>'.repeat(50)}</body></html>`);
  }
  await fs.writeFile(path.join(temporary, 'fixture.epub'), await zip.generateAsync({type: 'nodebuffer'}));
  await fs.writeFile(path.join(temporary, 'backend.js'), 'exports.default = {supportChangeFolder: true};');
  let viewerPath = path.join(root, 'src/frontend/reader/Viewer.tsx');
  if (process.env.AWAKEN_SELECTION_BEFORE) {
    for (const name of ['Viewer', 'Tools']) {
      const source = await fs.readFile(path.join(process.env.AWAKEN_SELECTION_BEFORE, name + '.tsx'), 'utf8');
      const rewritten = source.replace(/from '(\.[^']+)'/g, (_, specifier) =>
        `from ${JSON.stringify(specifier === './Tools' ? path.join(temporary, 'Tools.tsx') : path.resolve(root, 'src/frontend/reader', specifier))}`);
      await fs.writeFile(path.join(temporary, name + '.tsx'), rewritten);
    }
    viewerPath = path.join(temporary, 'Viewer.tsx');
  }
  const viewer = JSON.stringify(viewerPath);
  await fs.writeFile(path.join(temporary, 'entry.jsx'), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Viewer} from ${viewer};
function Harness() {
  const [notes, setNotes] = React.useState(JSON.parse(localStorage.getItem('notes') || '[]'));
  const [content, setContent] = React.useState();
  React.useEffect(() => {fetch('/fixture.epub').then(r => r.arrayBuffer()).then(setContent);}, []);
  window.testNotes = notes;
  return content && <Viewer content={content} notes={notes} bookmarks={[]} onBookmarkInfo={() => {}}
    onError={e => {window.testError = e.message;}} onLoad={(indexes, pages, jump) => {window.testJump = jump; window.testIndexes = indexes; window.testReady = true;}}
    onChangeNotes={value => {localStorage.setItem('notes', JSON.stringify(value)); setNotes([...value]);}} />;
}
createRoot(document.getElementById('container')).render(<Harness />);
`);
  const ts = require('typescript');
  const entry = ts.transpileModule(await fs.readFile(path.join(temporary, 'entry.jsx'), 'utf8'),
    {compilerOptions: {jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext}}).outputText;
  await fs.writeFile(path.join(temporary, 'entry.js'), entry);
  await new Promise((resolve, reject) => webpack({
    mode: 'development', devtool: false, entry: path.join(temporary, 'entry.js'),
    output: {path: temporary, filename: 'bundle.js'},
    resolve: {extensions: ['.tsx', '.ts', '.js'], modules: [path.join(root, 'node_modules')],
      alias: {[path.join(root, 'src/backend')]: path.join(temporary, 'backend.js')}},
    resolveLoader: {modules: [path.join(root, 'node_modules')]},
    module: {rules: [
      {test: /\.tsx?$/, use: {loader: 'ts-loader', options: {transpileOnly: true, configFile: path.join(root, 'tsconfig.json')}}},
      {test: /\.scss$/, use: [{loader: 'css-loader', options: {modules: {localIdentName: '[local]', exportOnlyLocals: true}}}, 'sass-loader']}
    ]},
    plugins: [new webpack.DefinePlugin({'process.env.isProd': 'true'})], stats: 'errors-only'
  }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString('errors-only'))) : resolve()));
  // The test uses production component logic and a minimal layout, with the
  // actual CSS loaded as a separate stylesheet for the positioned tools menu.
  const sass = require('sass');
  await fs.writeFile(path.join(temporary, 'reader.css'), sass.compile(path.join(root, 'src/frontend/styles/reader.module.scss'), {logger: sass.Logger.silent}).css);
  const theme = await fs.readFile(path.join(root, 'src/frontend/styles/awaken.hana-theme.scss'), 'utf8');
  await fs.writeFile(path.join(temporary, 'hana.css'), sass.compileString(theme + '\n@import "hana-style";', {loadPaths: [path.join(root, 'node_modules/hana-ui')], logger: sass.Logger.silent}).css);
  await fs.mkdir(path.join(temporary, 'dist/assets/fonts'), {recursive: true});
  await fs.copyFile(path.join(root, 'node_modules/hana-ui/dist/assets/fonts/hanafont.woff'), path.join(temporary, 'dist/assets/fonts/hanafont.woff'));
  await fs.writeFile(path.join(temporary, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="/hana.css"/><link rel="stylesheet" href="/reader.css"/><style>html,body,#container{margin:0;width:100%;height:100%;}#container{position:relative;}g.awaken-highlight{fill:orange!important;fill-opacity:0.5;}</style></head><body><div id="container"></div><script src="/bundle.js"></script></body></html>');
  let browser;
  let deadline;
  let escaped = false;
  const server = http.createServer(async (req, res) => {
    if (req.url === '/escape.html') {escaped = true; res.end('<script>parent.testBookScript=true</script>'); return;}
    try {const filename = req.url === '/' ? 'index.html' : req.url.slice(1); res.setHeader('Content-Type', filename.endsWith('.js') ? 'application/javascript' : filename.endsWith('.css') ? 'text/css' : filename.endsWith('.epub') ? 'application/epub+zip' : 'text/html'); res.end(await fs.readFile(path.join(temporary, filename)));}
    catch {res.writeHead(404); res.end();}
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = process.env.AWAKEN_CHROMIUM_PATH ?
      await playwright.chromium.launch({headless: true, executablePath: process.env.AWAKEN_CHROMIUM_PATH}) :
      await playwright.webkit.launch({headless: true});
    deadline = setTimeout(() => {console.error('Browser test exceeded 60 seconds'); browser.close();}, 60000);
    const page = await browser.newPage({viewport: {width: 900, height: 700}});
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => console.error('Browser:', error.message));
    page.on('console', message => {if (message.type() === 'error') console.error('Console:', message.text());});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.testReady || window.testError);
    assert.equal(await page.evaluate(() => window.testError), undefined);
    const bookScriptsBlocked = async () => {
      assert.deepEqual(await page.evaluate(() => [!!window.testBookScript, !!window.testExternalScript, !!window.testBookEvent]), [false, false, false]);
    };
    await bookScriptsBlocked();
    await page.evaluate(() => document.querySelector('iframe').contentDocument.getElementById('escape').dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true})));
    // WebKit may report selectionchange after mouseup (also covers keyboard
    // selection). No extra click must be needed to create a highlight.
    await page.evaluate(() => {
      const frame = document.querySelector('iframe');
      const doc = frame.contentDocument;
      doc.defaultView.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
      const range = doc.createRange();
      range.setStart(doc.getElementById('target').firstChild, 0);
      range.setEnd(doc.getElementById('target').firstChild, 14);
      const selection = doc.defaultView.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
    });
    await page.waitForFunction(() => document.querySelector('g.awaken-highlight') && getComputedStyle(document.querySelector('.tools')).display !== 'none', undefined, {timeout: 5000});
    assert.equal(await page.evaluate(() => window.testNotes.filter(note => !note.removed).length), 1);
    const visibleMenu = async () => {
      const box = await page.locator('.toolsMenu').boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 900 && box.y + box.height <= 700);
    };
    await visibleMenu();
    console.log('PASS: selection after mouseup creates and saves a highlight and opens visible tools');
    await page.screenshot({path: path.join(temporary, 'selection.png')});
    console.log('Screenshot:', path.join(temporary, 'selection.png'));
    await page.locator('.toolsMenu .icon-edit').click();
    await page.locator('textarea').fill('Saved WebKit annotation');
    await page.getByText('确认', {exact: true}).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('notes'))[0].annotation === 'Saved WebKit annotation');
    await page.locator('.toolsBg').click({position: {x: 800, y: 600}});
    await page.reload();
    await page.waitForFunction(() => window.testReady && document.querySelector('g.awaken-highlight'));
    assert.equal(await page.evaluate(() => window.testNotes[0].annotation), 'Saved WebKit annotation');
    console.log('PASS: edited annotation and highlight survive reopening');
    // marks-pane receives the iframe's click and forwards it to the SVG mark;
    // the SVG itself intentionally has pointer-events:none.
    const highlight = await page.locator('g.awaken-highlight rect').first().boundingBox();
    await page.mouse.click(highlight.x + highlight.width / 2, highlight.y + highlight.height / 2);
    await page.locator('.toolsMenu .icon-error').click();
    await page.waitForFunction(() => window.testNotes[0].removed && !document.querySelector('g.awaken-highlight'));
    console.log('PASS: clicking an existing highlight opens tools and deletion persists');
    const drag = await page.evaluate(() => {
      const frame = document.querySelector('iframe'), doc = frame.contentDocument;
      const range = doc.createRange(); range.setStart(doc.getElementById('target').firstChild, 0); range.setEnd(doc.getElementById('target').firstChild, 14);
      const rect = range.getClientRects()[0], offset = frame.getBoundingClientRect();
      return {x1: offset.left + rect.left + 1, x2: offset.left + rect.right - 1, y: offset.top + (rect.top + rect.bottom) / 2};
    });
    if (process.env.AWAKEN_CHROMIUM_PATH) {
      // Chromium's Playwright drag detector injects script into every iframe;
      // use native input events so sandboxed EPUBs can keep scripts disabled.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: drag.x1, y: drag.y, button: 'left', buttons: 1, clickCount: 1});
      for (let step = 1; step <= 15; step++) await cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: drag.x1 + (drag.x2 - drag.x1) * step / 15, y: drag.y, button: 'left', buttons: 1});
      await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: drag.x2, y: drag.y, button: 'left', buttons: 0, clickCount: 1});
      await cdp.detach();
    } else {
      await page.mouse.move(drag.x1, drag.y); await page.mouse.down();
      await page.mouse.move(drag.x2, drag.y, {steps: 15}); await page.mouse.up();
    }
    await page.waitForFunction(() => window.testNotes.some(note => !note.removed) && getComputedStyle(document.querySelector('.tools')).display !== 'none');
    console.log('PASS: real mouse drag selection creates a highlight');
    await page.locator('.toolsBg').click({position: {x: 800, y: 600}});
    await page.evaluate(() => window.testJump(2, window.testIndexes[1]));
    await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.getElementById('target')?.textContent.endsWith('chapter b.'));
    await page.evaluate(() => {
      const doc = document.querySelector('iframe').contentDocument, range = doc.createRange();
      range.setStart(doc.getElementById('target').firstChild, 0); range.setEnd(doc.getElementById('target').firstChild, 14);
      doc.defaultView.getSelection().removeAllRanges(); doc.defaultView.getSelection().addRange(range);
    });
    await page.waitForFunction(() => window.testNotes.filter(note => !note.removed).length === 2);
    await visibleMenu();
    await page.locator('.toolsBg').click({position: {x: 800, y: 600}});
    await page.evaluate(() => window.testJump(3));
    await page.waitForFunction(() => document.querySelector('iframe').getBoundingClientRect().left < 0);
    await page.evaluate(() => {
      const frame = document.querySelector('iframe'), doc = frame.contentDocument, offset = frame.getBoundingClientRect();
      const para = [...doc.querySelectorAll('p')].find(p => {
        const rect = p.getBoundingClientRect(); return rect.left + offset.left >= 16 && rect.right + offset.left <= 884 && rect.top >= 0 && rect.bottom < 680;
      });
      if (!para) throw new Error('No visible paragraph on later page');
      const range = doc.createRange(); range.setStart(para.firstChild, 0); range.setEnd(para.firstChild, 12);
      doc.defaultView.getSelection().removeAllRanges(); doc.defaultView.getSelection().addRange(range);
    });
    await page.waitForFunction(() => window.testNotes.filter(note => !note.removed).length === 3);
    await visibleMenu();
    await bookScriptsBlocked();
    assert.equal(escaped, false);
    console.log('PASS: selections in another chapter and on a later page open tools within the viewport');
    console.log('PASS: EPUB scripts, inline events, refresh and SVG navigation remain blocked');
  } finally {
    clearTimeout(deadline);
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    console.log('Test artifacts:', temporary);
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
