const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, deps = {}, globals = {}) {
  const filename = path.join(root, file);
  const source = fs.readFileSync(filename, 'utf8');
  const js = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React}}).outputText;
  const exports = {};
  vm.runInNewContext(js, {exports, require(name) {
    if (Object.hasOwn(deps, name)) return deps[name];
    return require(require.resolve(name, {paths: [path.dirname(filename)]}));
  }, console, process, setTimeout, clearTimeout, ArrayBuffer, Uint8Array, URL, ...globals}, {filename});
  return exports;
}
const clone = value => JSON.parse(JSON.stringify(value));
const hash = letter => letter.repeat(32);
const book = (letter = 'a', fields = {}) => ({hash: hash(letter), type: 'EPUB', name: 'Example ' + letter, author: 'Author', ts: 10, ...fields});
const note = (position, fields = {}) => ({
  cfi: `epubcfi(/6/4!/4/2,/1:${position},/1:${position + 1})`,
  start: `epubcfi(/6/4!/4/2/1:${position})`, end: `epubcfi(/6/4!/4/2/1:${position + 1})`,
  page: position, modified: 10, ...fields
});
const config = fields => ({ts: 10, progress: 5, lastProgress: 5, notes: [], bookmarks: [], ...fields});
function fixture(createClient, davPrefix = '') {
  const files = new Map();
  const remote = new Map([['Awaken/books.json', '[]']]);
  const etags = new Map();
  const puts = [];
  const worker = {fs: {
    async exists(p) {return files.has(p);},
    async readFile(p) {if (!files.has(p)) throw new Error('Missing: ' + p); return files.get(p);},
    async writeFile(p, data) {files.set(p, data);},
    async removeFile(p) {files.delete(p);},
    async createDir(p) {files.set(p, null);},
    async readDir() {return [];}
  }, async showMessage() {}, getCoverUrl() {return 'cover';}};
  const client = {
    async exists(p) {return remote.has(p);},
    async createDirectory(p) {remote.set(p, null);},
    async deleteFile(p) {remote.delete(p);},
    async getDirectoryContents(p) {
      const prefix = p === '/' ? '' : p.replace(/\/$/, '') + '/';
      return [...remote].filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
        .map(([key, value]) => ({basename: key.slice(prefix.length), type: value === null ? 'directory' : 'file'}));
    },
    async getFileContents(p, options = {}) {
      if (!remote.has(p)) throw Object.assign(new Error('Not found'), {status: 404});
      const data = remote.get(p);
      return options.details ? {data, headers: {etag: String(etags.get(p) || 1)}} : data;
    },
    async putFileContents(p, data, options = {}) {
      const etag = String(etags.get(p) || 1);
      if (options.headers?.['If-Match'] && options.headers['If-Match'] !== etag) {
        throw Object.assign(new Error('Conflict'), {status: 412});
      }
      puts.push({path: p, data, options});
      remote.set(p, data);
      etags.set(p, Number(etag) + 1);
    }
  };
  const epub = require('epubjs');
  const epubStub = {...epub, default: () => ({open: async () => {}, coverUrl: async () => null,
    loaded: {metadata: Promise.resolve({title: 'Example a', creator: 'Author'})}, destroy() {}})};
  const sync = load('src/frontend/sync.ts');
  const {WebDAV} = load('src/frontend/webdav.ts', {
    'webdav/web': {createClient: createClient || (() => client)}, epubjs: epubStub, 'js-md5': {hex: () => hash('a')},
    '../backend': {default: {worker, davPrefix}}, './utils': {fillBookCover: async () => {}},
    './reader/common': {}, './sync': sync
  });
  function seed(item, cfg = config()) {
    files.set(item.hash, null);
    files.set(`${item.hash}/config.json`, JSON.stringify(cfg));
    files.set(`${item.hash}/${item.name}.epub`, new ArrayBuffer(8));
  }
  function seedRemote(item, cfg = config()) {
    remote.set('Awaken/' + item.hash, null);
    remote.set(`Awaken/${item.hash}/config.json`, JSON.stringify(cfg));
    remote.set(`Awaken/${item.hash}/${item.name}.epub`, new ArrayBuffer(8));
  }
  return {files, remote, puts, worker, client, seed, seedRemote, dav: new WebDAV(), WebDAV, etags};
}
module.exports = {load, clone, hash, book, note, config, fixture};
