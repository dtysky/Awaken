const {test} = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const renderer = require('react-test-renderer');
const md5 = require('js-md5');
const {load, fixture, book, config, note, clone} = require('./helpers.cjs');
const {findMatchingBooks} = load('src/frontend/sync.ts');
const bytes = value => Uint8Array.from(value).buffer;
const component = name => props => React.createElement(name, props, props.children);
const flush = () => new Promise(resolve => setImmediate(resolve));

test('metadata matches ignore formatting differences but do not merge different authors or deleted books', () => {
  const first = book('a', {name: 'Ａ Book  Title ', author: ' Some Author '});
  const other = book('b', {name: 'A Book Title', author: 'Someone Else'});
  const removed = book('c', {name: 'A Book Title', author: 'Some Author', removed: true});
  assert.deepEqual(clone(findMatchingBooks([first, other, removed], {name: 'a book title', author: 'some author'})), [first]);
});

test('repackaged books are stopped before writing files and preserve existing notes, progress, and shelf', async () => {
  const f = fixture(undefined, '', {md5});
  const original = bytes([80, 75, 1, 2]), incoming = bytes([80, 75, 3, 4]);
  const item = book('a', {hash: md5.hex(original), bookshelf: {value: '文学', ts: 20}});
  f.seed(item, config({lastProgress: 90, notes: [note(10)], bookmarks: [note(20)]}));
  f.files.set(`${item.hash}/${item.name}.epub`, original);
  f.files.set('repacked.epub', incoming);
  const before = new Map(f.files), books = [item];
  await assert.rejects(f.dav.addBook('repacked.epub', books), error => {
    assert.equal(error.duplicateBook.identical, false);
    assert.equal(error.duplicateBook.matches[0].hash, item.hash);
    return true;
  });
  assert.equal(books.length, 1);
  assert.deepEqual(f.files, before);
  assert.equal(books[0].bookshelf.value, '文学');
});

test('skipping a duplicate waits for navigation parsing before disposing the EPUB', async () => {
  let ready, destroyed = false;
  const f = fixture(undefined, '', {md5, epub: () => ({
    isOpen: true, open: async () => {}, loaded: {metadata: Promise.resolve({title: 'Example a', creator: 'Author'})},
    ready: new Promise(resolve => {ready = resolve;}), destroy() {destroyed = true;}
  })});
  f.files.set('repacked.epub', bytes([80, 75, 3]));
  await assert.rejects(f.dav.addBook('repacked.epub', [book()]), error => !!error.duplicateBook);
  assert.equal(destroyed, false);
  ready(); await flush();
  assert.equal(destroyed, true);
});

test('explicitly importing another edition creates a separate record; exact duplicates are still rejected', async () => {
  const f = fixture(undefined, '', {md5});
  const original = bytes([1]), incoming = bytes([2]);
  const item = book('a', {hash: md5.hex(original)});
  f.seed(item, config({notes: [note(10)]}));
  f.files.set('another.epub', incoming);
  const originalConfig = f.files.get(`${item.hash}/config.json`), books = [item];
  await f.dav.addBook('another.epub', books, true);
  assert.equal(books.length, 2);
  assert.equal(books[0].hash, md5.hex(incoming));
  assert.equal(f.files.get(`${item.hash}/config.json`), originalConfig);
  assert.equal(JSON.parse(f.files.get(`${books[0].hash}/config.json`)).notes.length, 0);
  await assert.rejects(f.dav.addBook('another.epub', books, true), error => error.duplicateBook.identical === true);
  assert.equal(books.length, 2);
});

test('same-title books by another author import normally and deleted copies can be restored with notes', async () => {
  const f = fixture(undefined, '', {md5});
  const item = book('b', {name: 'Example a', author: 'Another Author'});
  f.seed(item); f.files.set('input.epub', bytes([1, 2, 3]));
  const books = [item];
  await f.dav.addBook('input.epub', books);
  assert.equal(books.length, 2);
  const restored = books[0];
  await f.dav.saveConfig(restored, config({notes: [note(10)]}));
  await f.dav.removeBook(restored, books);
  await f.dav.addBook('input.epub', books);
  assert.equal(books.length, 2);
  assert.equal(restored.removed, undefined);
  assert.equal(JSON.parse(f.files.get(`${restored.hash}/config.json`)).notes.length, 1);
});

test('batch imports continue after duplicates, default to skipping, and only force explicitly selected editions', async () => {
  const Books = component('Books'), Modal = component('Modal');
  const existing = book('a'), library = [existing], calls = [];
  const settings = {folder: '/library', webDav: {url: '', user: '', password: ''}, read: {}};
  const dav = {connected: false, changeLocal: async () => {}, initialize: async () => {}, isDownloaded: async () => true,
    addBook: async (file, books, force) => {
      calls.push({file, force});
      if (file === 'exact.epub' || file === 'repacked.epub' && !force) {
        throw Object.assign(new Error('Duplicate'), {duplicateBook: {file, name: existing.name, author: existing.author,
          matches: [existing], identical: file === 'exact.epub'}});
      }
      books.unshift(book(file === 'new.epub' ? 'b' : 'c'));
    }};
  const App = load('src/frontend/App.tsx', {
    react: React, 'hana-ui': {Loading: component('Loading'), Modal},
    '../backend': {default: {worker: {showMessage: async () => {throw new Error('No per-file alerts expected');}}}},
    './reader/Reader': {default: component('Reader')}, './books/Books': {default: Books},
    './utils': {loadSettings: async () => settings, loadBooks: async () => library},
    './webdav': {default: dav}, './SyncStatus': {default: component('SyncStatus')}, './styles/app.module.scss': {default: {}}, './styles/global.scss': {}
  }).default;
  let tree;
  await renderer.act(async () => {tree = renderer.create(React.createElement(App)); await flush();});
  await renderer.act(async () => tree.root.findByType(Books).props.onAddBooks(['exact.epub', 'repacked.epub', 'new.epub']));
  assert.equal(tree.root.findByType(Books).props.books[0].length, 2);
  const report = () => tree.root.findAllByType(Modal).find(node => node.props.title === '导入结果');
  assert.equal(report().props.show, true);
  assert.equal(report().findByType('input').props.checked, false);
  // The only initial action skips duplicates. A force-import button is added
  // only after the user explicitly checks the matching book.
  assert.equal(React.Children.toArray(report().props.actions.props.children).length, 1);
  await renderer.act(async () => report().findByType('input').props.onChange({target: {checked: true}}));
  const actions = React.Children.toArray(report().props.actions.props.children);
  assert.equal(actions.length, 2);
  await renderer.act(async () => {actions[1].props.onClick(); await flush();});
  assert.deepEqual(calls, [{file: 'exact.epub', force: false}, {file: 'repacked.epub', force: false},
    {file: 'new.epub', force: false}, {file: 'repacked.epub', force: true}]);
  assert.equal(tree.root.findByType(Books).props.books[0].length, 3);
  await renderer.act(async () => tree.unmount());
});
