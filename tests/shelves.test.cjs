const {test} = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const renderer = require('react-test-renderer');
const {load, clone, book} = require('./helpers.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));
const text = node => typeof node === 'string' ? node : node.children.map(text).join('');
const component = name => props => React.createElement(name, props, props.children);
const ShelfPicker = load('src/frontend/books/ShelfPicker.tsx', {
  react: React, 'react-dom': {createPortal: child => child}, '../styles/books.module.scss': {default: {}}
}, {document: {body: {}, activeElement: null}}).default;

test('shelf picker moves with one click, marks the current shelf, and deduplicates available shelves', async () => {
  const item = book('a', {bookshelf: {value: '文学', ts: 10}});
  let moved, closed = 0, tree;
  await renderer.act(async () => {tree = renderer.create(React.createElement(ShelfPicker, {
    book: item, books: [item, book('b', {bookshelf: {value: '历史', ts: 10}})], shelves: ['文学', '文学'],
    onMove: async shelf => {moved = shelf;}, onClose: () => {closed++;}
  }));});
  const options = tree.root.findByProps({'aria-label': '可选书架'}).findAllByType('button');
  assert.equal(options.length, 3);
  assert.equal(options.find(node => text(node).includes('文学')).props.disabled, true);
  await renderer.act(async () => {options.find(node => text(node).includes('默认书架')).props.onClick(); await flush();});
  assert.equal(moved, null); assert.equal(closed, 1);
  await renderer.act(async () => tree.unmount());
});

test('a new shelf is trimmed and created in one submit, while existing names choose the existing shelf', async () => {
  const moves = []; let tree;
  await renderer.act(async () => {tree = renderer.create(React.createElement(ShelfPicker, {
    book: book(), books: [book()], shelves: ['文学'], onMove: async shelf => {moves.push(shelf);}, onClose() {}
  }));});
  await renderer.act(async () => tree.root.findByType('input').props.onChange({target: {value: '  科幻  '}}));
  assert.ok(tree.root.findAllByType('button').some(node => text(node).includes('新建“科幻”并移入')));
  await renderer.act(async () => {tree.root.findByType('form').props.onSubmit({preventDefault() {}}); await flush();});
  assert.deepEqual(moves, ['科幻']);
  await renderer.act(async () => tree.root.findByType('input').props.onChange({target: {value: ' 文学 '}}));
  assert.equal(tree.root.findAllByType('button').some(node => text(node).includes('新建')), false);
  await renderer.act(async () => {tree.root.findByType('form').props.onSubmit({preventDefault() {}}); await flush();});
  assert.deepEqual(moves, ['科幻', '文学']);
  let prevented = false;
  tree.root.findByType('input').props.onKeyDown({key: 'Enter', nativeEvent: {isComposing: true}, preventDefault() {prevented = true;}});
  assert.equal(prevented, true);
  await renderer.act(async () => tree.unmount());
});

test('failed moves keep the picker and query open for retry; repeated clicks submit only once', async () => {
  let fail, calls = 0, closed = 0, tree;
  await renderer.act(async () => {tree = renderer.create(React.createElement(ShelfPicker, {
    book: book(), books: [book()], shelves: [],
    onMove: () => {calls++; return new Promise((resolve, reject) => {fail = reject;});}, onClose: () => {closed++;}
  }));});
  await renderer.act(async () => tree.root.findByType('input').props.onChange({target: {value: '历史'}}));
  await renderer.act(async () => {
    const submit = tree.root.findByType('form').props.onSubmit;
    submit({preventDefault() {}}); submit({preventDefault() {}}); await flush();
  });
  assert.equal(calls, 1);
  assert.equal(tree.root.findByType('input').props.disabled, true);
  await renderer.act(async () => {fail(new Error('磁盘空间不足')); await flush();});
  assert.equal(closed, 0);
  assert.equal(text(tree.root.findByProps({role: 'alert'})), '磁盘空间不足');
  assert.equal(tree.root.findByType('input').props.value, '历史');
  assert.equal(tree.root.findByType('input').props.disabled, false);
  await renderer.act(async () => tree.unmount());
});

test('shelf moves save locally before syncing and remain saved after a remote failure', async () => {
  const settings = {folder: '/library', webDav: {url: 'https://example.invalid', user: '', password: ''}, read: {}};
  const item = book(), Books = component('Books');
  let stored, diskFull = true, syncCalls = 0;
  const dav = {connected: true, changeLocal: async () => {}, initialize: async () => {}, isDownloaded: async () => true,
    saveBooks: async books => {if (diskFull) throw new Error('磁盘空间不足'); stored = clone(books);},
    syncBooks: async () => {syncCalls++; assert.equal(stored[0].bookshelf.value, '文学'); throw new Error('Offline');}};
  const App = load('src/frontend/App.tsx', {
    react: React, 'hana-ui': {Loading: component('Loading'), Modal: component('Modal')},
    '../backend': {default: {worker: {showMessage: async message => {throw new Error(message);}}}},
    './reader/Reader': {default: component('Reader')}, './books/Books': {default: Books},
    './utils': {loadSettings: async () => settings, loadBooks: async () => [item]},
    './webdav': {default: dav}, './SyncStatus': {default: component('SyncStatus')}, './styles/app.module.scss': {default: {}}, './styles/global.scss': {}
  }).default;
  let tree;
  await renderer.act(async () => {tree = renderer.create(React.createElement(App)); await flush();});
  await renderer.act(async () => {await assert.rejects(tree.root.findByType(Books).props.onMoveBook(item, '文学'), /磁盘空间不足/);});
  assert.equal(tree.root.findByType(Books).props.books[0][0].bookshelf, undefined);
  assert.equal(syncCalls, 0);
  diskFull = false;
  await renderer.act(async () => tree.root.findByType(Books).props.onMoveBook(item, '文学'));
  assert.equal(syncCalls, 1);
  assert.equal(tree.root.findByType(Books).props.books[0][0].bookshelf.value, '文学');
  assert.ok(stored[0].bookshelf.ts > 10);
  await renderer.act(async () => tree.unmount());
});

test('a connected shelf move clears synchronization progress on both success and failure', async () => {
  const settings = {folder: '/library', webDav: {url: 'https://example.invalid', user: '', password: ''}, read: {}};
  const item = book(), Books = component('Books'), Loading = component('Loading');
  let fail = false, finish;
  const dav = {connected: true, changeLocal: async () => {}, initialize: async () => {}, isDownloaded: async () => true,
    saveBooks: async () => {}, syncBooks: async (books, progress) => {
      progress('同步书目和书架...');
      await new Promise(resolve => {finish = resolve;});
      if (fail) throw new Error('Offline');
    }};
  const App = load('src/frontend/App.tsx', {
    react: React, 'hana-ui': {Loading, Modal: component('Modal')},
    '../backend': {default: {worker: {showMessage: async message => {throw new Error(message);}}}},
    './reader/Reader': {default: component('Reader')}, './books/Books': {default: Books},
    './utils': {loadSettings: async () => settings, loadBooks: async () => [item]},
    './webdav': {default: dav}, './SyncStatus': {default: component('SyncStatus')}, './styles/app.module.scss': {default: {}}, './styles/global.scss': {}
  }).default;
  let tree;
  await renderer.act(async () => {tree = renderer.create(React.createElement(App)); await flush();});
  for (const remoteFails of [false, true]) {
    fail = remoteFails;
    let moving;
    await renderer.act(async () => {moving = tree.root.findByType(Books).props.onMoveBook(item, '文学'); await flush();});
    assert.equal(tree.root.findByType(Loading).props.content, '同步书目和书架...');
    await renderer.act(async () => {finish(); await moving;});
    assert.equal(tree.root.findAllByType(Loading).length, 0, 'a completed shelf move must release its loading overlay');
  }
  await renderer.act(async () => tree.unmount());
});
