const {test} = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const renderer = require('react-test-renderer');
const {load, clone, book, note, config} = require('./helpers.cjs');
const component = name => {const fn = props => React.createElement(name, props, props.children); return fn;};
const flush = () => new Promise(resolve => setImmediate(resolve));

test('reader background saves use loaded notes and the latest page after rerenders', async () => {
  let hide, saved;
  const Viewer = component('Viewer'), Menu = component('Menu');
  const Reader = load('src/frontend/reader/Reader.tsx', {
    react: React, 'hana-ui': {Sidebar: component('Sidebar'), Loading: component('Loading'), Modal: component('Modal')},
    '../../backend': {default: {worker: {
      loadSettings: async () => ({read: {background: '#ffffff', highlight: '#000000'}}),
      setBackground: async () => {}, onAppHide: cb => {hide = cb;}, showMessage: async () => {}
    }}}, '../webdav': {default: {
      loadBook: async () => ({content: new ArrayBuffer(8), config: config({progress: 50, lastProgress: 50, notes: [note(10)]})}),
      saveConfig: async (book, value) => {saved = clone(value);}
    }}, './Viewer': {Viewer, EJumpAction: {}}, './common': {buildStyleUrl: () => '', checkNoteMark: () => ({exist: false, index: 0})},
    './Menu': {Menu}, './Indexes': {Indexes: component('Indexes')}, './Notes': {Notes: component('Notes')},
    './PageCtr': {PageCtr: component('PageCtr')}, '../styles/reader.module.scss': {default: {}}
  }, {document: {getElementById: () => ({})}}).default;
  let tree;
  await renderer.act(async () => {tree = renderer.create(React.createElement(Reader, {book: book(), syncRequest: 0, onClose() {}, onConnect: async () => {}})); await flush();});
  await renderer.act(async () => {hide(); await flush();});
  assert.equal(saved.progress, 50); assert.equal(saved.notes.length, 1);
  await renderer.act(async () => {tree.root.findByType(Viewer).props.onBookmarkInfo(note(75), true); await flush();});
  await renderer.act(async () => {hide(); await flush();});
  assert.equal(saved.progress, 75); assert.equal(saved.notes.length, 1);
  await renderer.act(async () => {tree.root.findByType(Viewer).props.onChangeNotes([note(10), note(20)]); await flush();});
  assert.equal(saved.notes.length, 2);
  await renderer.act(async () => tree.unmount());
});

test('viewer routes selections and clicked marks from their actual chapter without waiting for another mouseup', async () => {
  const {EventEmitter} = require('node:events');
  const rendition = new EventEmitter();
  const source = {cfiFromRange: () => note(20).cfi, window: {getSelection: () => ({rangeCount: 1, isCollapsed: false, getRangeAt: () => ({})})}};
  const otherChapter = {window: {}};
  const Tools = component('Tools');
  const epub = {spine: {hooks: {content: {register() {}}}}, locations: {generate: async () => [], cfiFromLocation: () => note(1).start},
    loaded: {navigation: Promise.resolve({toc: []})}, renderTo: () => rendition, destroy() {}};
  Object.assign(rendition, {hooks: {content: {register() {}}}, book: epub, annotations: {add() {}, remove() {}}, display: async () => {}, themes: {}});
  const Viewer = load('src/frontend/reader/Viewer.tsx', {
    react: React, epubjs: {default: () => epub}, './Tools': {Tools},
    './contentSecurity': load('src/frontend/reader/contentSecurity.ts'),
    './common': {mergeCFI: () => ''}, '../styles/reader.module.scss': {default: {}}
  }).Viewer;
  let tree;
  await renderer.act(async () => {tree = renderer.create(React.createElement(Viewer, {content: new ArrayBuffer(8), notes: [], bookmarks: [], onLoad() {}, onError: error => {throw error;}, onChangeNotes() {}})); await flush();});
  // No locationChanged or prior mouseup is required for keyboard / delayed WebKit selection.
  await renderer.act(async () => rendition.emit('selected', note(10).cfi, otherChapter));
  assert.equal(tree.root.findByType(Tools).props.content, otherChapter);
  assert.equal(tree.root.findByType(Tools).props.cfi, note(10).cfi);
  await renderer.act(async () => {rendition.emit('mousedown', {}, source); rendition.emit('selected', note(20).cfi, source);});
  assert.equal(tree.root.findByType(Tools).props.cfi, note(10).cfi);
  await renderer.act(async () => rendition.emit('mouseup', {}, source));
  assert.equal(tree.root.findByType(Tools).props.content, source);
  assert.equal(tree.root.findByType(Tools).props.cfi, note(20).cfi);
  await renderer.act(async () => tree.root.findByType(Tools).props.onClose());
  await renderer.act(async () => rendition.emit('markClicked', note(10).cfi, {}, otherChapter));
  assert.equal(tree.root.findByType(Tools).props.content, otherChapter);
  assert.equal(tree.root.findByType(Tools).props.cfi, note(10).cfi);
  await renderer.act(async () => tree.unmount());
});

test('selection tools save immediately, edit the same note, and delete with a tombstone', async () => {
  const common = load('src/frontend/reader/common.ts');
  const IconButton = component('IconButton'), Modal = component('Modal'), TextArea = component('TextArea');
  const rect = {left: 0, top: 0, right: 900, bottom: 700, width: 900, height: 700};
  const parent = {getBoundingClientRect: () => rect};
  const menu = {getBoundingClientRect: () => ({width: 180, height: 60}), parentElement: {...parent, parentElement: parent}};
  const range = {collapsed: false, toString: () => 'Selected text', getClientRects: () => [{left: 950, right: 1150, top: 600, bottom: 640}], getBoundingClientRect: () => rect};
  const content = {range: () => range, window: {frameElement: {getBoundingClientRect: () => ({left: -900, top: 0})}, getSelection: () => ({removeAllRanges() {}})}};
  let added = 0, removed = 0, saved;
  const rendition = {book: {locations: {locationFromCfi: () => 20}}, annotations: {add() {added++;}, remove() {removed++;}}};
  const Tools = load('src/frontend/reader/Tools.tsx', {
    react: React, 'hana-ui': {IconButton, Modal, TextArea}, './common': common,
    '../styles/reader.module.scss': {default: {tools: 'tools', toolsMenu: 'toolsMenu', toolsBg: 'toolsBg'}}
  }, {document: {getElementById: () => parent}}).Tools;
  const original = [note(10), note(30)];
  function Harness() {
    const [notes, setNotes] = React.useState(original);
    const [cfi, setCFI] = React.useState(note(20).cfi);
    return React.createElement(Tools, {notes, cfi, rendition, content,
      onChangeNotes: value => {saved = clone(value); setNotes(value);}, onClose: () => setCFI(''), onError: error => {throw error;}});
  }
  let tree;
  await renderer.act(async () => {tree = renderer.create(React.createElement(Harness), {createNodeMock: () => menu});});
  assert.equal(added, 1);
  assert.deepEqual(original.map(item => item.page), [10, 30]);
  assert.deepEqual(saved.map(item => item.page), [10, 20, 30]);
  assert.equal(saved[1].text, 'Selected text');
  const position = tree.root.findByProps({className: 'toolsMenu'}).props.style;
  assert.ok(position.left >= 98 && position.left <= 802);
  assert.ok(position.top <= 632);
  await renderer.act(async () => tree.root.findAllByType(IconButton).find(item => item.props.type === 'edit').props.onClick());
  await renderer.act(async () => tree.root.findByType(TextArea).props.onChange({target: {value: 'A saved annotation'}}));
  await renderer.act(async () => tree.root.findByType(Modal).props.confirm());
  assert.equal(saved[1].annotation, 'A saved annotation');
  assert.equal(added, 1);
  await renderer.act(async () => tree.root.findAllByType(IconButton).find(item => item.props.type === 'error').props.onClick());
  assert.ok(saved[1].removed);
  assert.equal(removed, 1);
  assert.equal(tree.root.findByProps({className: 'tools'}).props.style.display, 'none');
  await renderer.act(async () => tree.unmount());
});

test('editing only the WebDAV password saves it and reconnects with the new credentials', async () => {
  const settings = {folder: '/library', webDav: {url: 'https://example.invalid', user: 'reader', password: 'old'}, read: {}};
  let saved, connected;
  const Books = component('Books');
  const dav = {connected: false, changeLocal: async () => {}, initialize: async () => {}, isDownloaded: async () => true,
    changeRemote: async value => {connected = clone(value); dav.connected = true;}, syncBooks: async books => books};
  const App = load('src/frontend/App.tsx', {
    react: React, 'hana-ui': {Loading: component('Loading'), Modal: component('Modal')},
    '../backend': {default: {worker: {showMessage: async message => {throw new Error(message);}}}},
    './reader/Reader': {default: component('Reader')}, './books/Books': {default: Books},
    './utils': {loadSettings: async () => settings, loadBooks: async () => [], saveSettings: async value => {saved = clone(value);}},
    './webdav': {default: dav}, './SyncStatus': {default: component('SyncStatus')}, './styles/app.module.scss': {default: {}}, './styles/global.scss': {}
  }).default;
  let tree;
  await renderer.act(async () => {tree = renderer.create(React.createElement(App)); await flush();});
  await renderer.act(async () => {
    await tree.root.findByType(Books).props.onUpdateSettings({...settings, webDav: {...settings.webDav, password: 'new'}});
  });
  assert.equal(saved.webDav.password, 'new'); assert.equal(connected.password, 'new');
  await renderer.act(async () => tree.unmount());
});

test('the sync-all action retries a connection failure, processes all shelves, and refreshes download status', async () => {
  const settings = {folder: '/library', webDav: {url: 'https://example.invalid', user: 'reader', password: 'secret'}, read: {}};
  const library = [book('a'), book('b', {bookshelf: {value: 'Another shelf', ts: 10}})];
  const Books = component('Books'), SyncStatus = component('SyncStatus'), Loading = component('Loading');
  const messages = [], cached = new Set();
  let connectionFails = true, fullCalls = 0, normalCalls = 0, finish;
  const dav = {connected: false, syncState: {}, initialize: async () => {}, changeLocal: async () => {},
    isDownloaded: async item => cached.has(item.hash),
    changeRemote: async () => {if (connectionFails) throw new Error('Offline'); dav.connected = true;},
    syncBooks: async value => {normalCalls++; return value;},
    syncAllBooks: async (value, progress) => {
      fullCalls++; assert.equal(value.length, 2);
      progress('[1/2] 同步笔记并下载…');
      await new Promise(resolve => {finish = resolve;});
      value.forEach(item => cached.add(item.hash));
      return value;
    }};
  const App = load('src/frontend/App.tsx', {
    react: React, 'hana-ui': {Loading, Modal: component('Modal')},
    '../backend': {default: {worker: {showMessage: async message => {messages.push(message);}}}},
    './reader/Reader': {default: component('Reader')}, './books/Books': {default: Books},
    './utils': {loadSettings: async () => settings, loadBooks: async () => library},
    './webdav': {default: dav}, './SyncStatus': {default: SyncStatus}, './styles/app.module.scss': {default: {}}, './styles/global.scss': {}
  }).default;
  let tree;
  await renderer.act(async () => {tree = renderer.create(React.createElement(App)); await flush();});
  await renderer.act(async () => tree.root.findByType(Books).props.onSyncAll());
  assert.deepEqual(messages, ['Offline']);
  connectionFails = false;
  await renderer.act(async () => {tree.root.findByType(SyncStatus).props.onRetry(); await flush();});
  assert.equal(fullCalls, 1);
  assert.equal(tree.root.findByType(Loading).props.content, '[1/2] 同步笔记并下载…');
  await renderer.act(async () => tree.root.findByType(Books).props.onSyncAll());
  assert.equal(fullCalls, 1);
  await renderer.act(async () => {finish(); await flush();});
  assert.equal(tree.root.findByType(Books).props.downloaded[library[0].hash], true);
  assert.equal(tree.root.findByType(Books).props.downloaded[library[1].hash], true);
  assert.equal(tree.root.findAllByType(Loading).length, 0);
  assert.equal(normalCalls, 0);
  await renderer.act(async () => tree.root.findByType(Books).props.onSync());
  assert.equal(normalCalls, 1);
  await renderer.act(async () => tree.unmount());
});
