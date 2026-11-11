/**
 * @File   : webdav.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/11/15 22:54:37
 */
import {createClient, WebDAVClient} from 'webdav/web';
import ePub from 'epubjs';
import * as md5 from 'js-md5';

import bk from '../backend';
import {IBook, IBookConfig, IBookNote} from '../interfaces/protocols';
import {fillBookCover, searchFirstInBook} from './utils';
import {ISystemSettings} from '../interfaces';
import {splitCFI} from './reader/common';
import {ISyncState, findMatchingBooks, mergeBooks, mergeConfig, mergeImportedNotes, safeRemoteEpubFile, serializeBooks, validateBooks} from './sync';

export interface IBookImportDuplicate {
  file: string;
  name: string;
  author: string;
  matches: IBook[];
  identical: boolean;
}

class DuplicateBookError extends Error {
  constructor(public duplicateBook: IBookImportDuplicate) {
    super(`书库中已有《${duplicateBook.name}》，已跳过重复导入。`);
  }
}

export interface IBookContent {
  content: ArrayBuffer;
  config: IBookConfig;
  // generate once then save to local
  pages?: string;
}

export class WebDAV {
  private _client: WebDAVClient;
  private _folder: string;
  private _remoteFolder = 'Awaken';
  private _writes: Promise<any> = Promise.resolve();
  private _syncs: Promise<any> = Promise.resolve();
  private _listeners = new Set<(state: ISyncState) => void>();
  private _state: ISyncState = {phase: 'local', libraryPending: 0, pendingBooks: {}};

  get connected() { return !!this._client; }
  get syncState() { return this._state; }

  public subscribe(listener: (state: ISyncState) => void) {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  private _publish(update: Partial<ISyncState>) {
    this._state = {...this._state, ...update};
    this._listeners.forEach(listener => listener(this._state));
  }

  private _write(path: string, data: string | ArrayBuffer, base: 'Books' | 'None' = 'Books') {
    const task = this._writes.catch(() => {}).then(() => bk.worker.fs.writeFile(path, data, base));
    this._writes = task;
    return task;
  }

  private _saveState() {
    return this._write('sync-state.json', JSON.stringify(this._state));
  }

  public async initialize() {
    if (await bk.worker.fs.exists('sync-state.json', 'Books')) {
      const saved = JSON.parse(await bk.worker.fs.readFile('sync-state.json', 'utf8', 'Books') as string);
      this._publish({...saved, pendingBooks: saved.pendingBooks || {},
        phase: saved.phase === 'syncing' ? 'pending' : saved.phase});
    }
  }

  private async _pending(hash?: string) {
    const revision = Math.max(Date.now(), this._state.libraryPending + 1, ...Object.values(this._state.pendingBooks).map(n => n + 1));
    this._publish({phase: this._state.phase === 'syncing' ? 'syncing' : 'pending', error: undefined,
      ...(hash ? {pendingBooks: {...this._state.pendingBooks, [hash]: revision}} : {libraryPending: revision})});
    await this._saveState();
  }

  private _runSync<T>(action: () => Promise<T>): Promise<T> {
    const task = this._syncs.catch(() => {}).then(async () => {
      this._publish({phase: 'syncing', error: undefined});
      try {
        const result = await action();
        const pending = this._state.libraryPending || this._state.allBooksPending || Object.keys(this._state.pendingBooks).length;
        this._publish({phase: pending ? 'pending' : 'synced', lastSync: Date.now(), error: undefined});
        await this._saveState();
        return result;
      } catch (error) {
        this._publish({phase: 'error', error: error.message || String(error)});
        await this._saveState();
        throw error;
      }
    });
    this._syncs = task;
    return task;
  }

  private _remotePath(path: string) {
    return this._remoteFolder ? `${this._remoteFolder}/${path}` : path;
  }

  private _remoteEpubPath(book: IBook) {
    return this._remotePath(`${book.hash}/${book.remoteFile || `${book.name}.epub`}`);
  }

  private async _findLibrary(client: WebDAVClient, url: string): Promise<string> {
    // Existing indexes take precedence over creating a new library. The URL can
    // point either to the WebDAV root or directly to the library directory.
    for (const folder of ['', 'Awaken']) {
      const index = folder ? `${folder}/books.json` : 'books.json';
      try {
        validateBooks(JSON.parse(await client.getFileContents(index, {format: 'text'}) as string));
        return folder;
      } catch (error) {
        if (error.status !== 404 && error.response?.status !== 404) { throw error; }
      }
    }
    const assertNoBooks = async (folder: string) => {
      const entries = await client.getDirectoryContents(folder || '/') as any[];
      if (entries.some(entry => entry.type === 'directory' && /^[a-f0-9]{32}$/i.test(entry.basename))) {
        throw new Error('远端存在书籍目录，但缺少 books.json 索引。请恢复索引后重试，现有书籍未修改。');
      }
    };
    await assertNoBooks('');
    const finalSegment = decodeURIComponent(new URL(url).pathname).replace(/\/+$/, '').split('/').pop();
    const folder = finalSegment?.toLowerCase() === 'awaken' ? '' : 'Awaken';
    if (folder) {
      if (await client.exists(folder)) { await assertNoBooks(folder); }
      else { await client.createDirectory(folder); }
    }
    const index = folder ? `${folder}/books.json` : 'books.json';
    await client.putFileContents(index, '[]', {overwrite: false});
    validateBooks(JSON.parse(await client.getFileContents(index, {format: 'text'}) as string));
    return folder;
  }

  public async changeRemote(options: ISystemSettings['webDav']) {
    this._client = undefined;
    if (!options.url) {
      this._publish({phase: 'local', lastSync: undefined, bookCount: undefined, allBooksPending: false, remote: undefined, error: undefined});
      await this._saveState();
      return;
    }
    const url = options.url.trim().replace(/\/+$/, '');
    const client = createClient(`${bk.davPrefix}${url}`, {username: options.user, password: options.password});
    try {
      this._remoteFolder = await this._findLibrary(client, url);
      const remote = `${url}|${options.user}|${this._remoteFolder || '.'}`;
      this._client = client;
      this._publish({remote, lastSync: remote === this._state.remote ? this._state.lastSync : undefined,
        bookCount: remote === this._state.remote ? this._state.bookCount : undefined,
        allBooksPending: remote === this._state.remote && this._state.allBooksPending,
        phase: 'pending', error: undefined});
      await this._saveState();
    } catch (error) {
      this._publish({phase: 'error', error: `连接失败：${error.message || error}`});
      await this._saveState();
      throw error;
    }
  }

  public async changeLocal(folder: string, onUpdate?: (info: string) => void) {
    if (!this._folder) { this._folder = folder; return; }
    if (this._folder === folder) { return; }
    onUpdate?.('开始迁移本地书籍...');
    await this._writes;
    const {fs} = bk.worker;
    for (const sub of await fs.readDir('', 'Books')) {
      if (!sub.isDir) {
        await fs.writeFile(`${folder}/${sub.path}`, await fs.readFile(sub.path, 'binary', 'Books'), 'None');
        continue;
      }
      await fs.createDir(`${folder}/${sub.path}`, 'None');
      for (const entry of await fs.readDir(sub.path, 'Books')) {
        if (entry.isDir) { continue; }
        onUpdate?.(`迁移 ${entry.path}...`);
        await fs.writeFile(`${folder}/${sub.path}/${entry.path}`, await fs.readFile(`${sub.path}/${entry.path}`, 'binary', 'Books'), 'None');
      }
    }
    this._folder = folder;
  }

  public async saveBooks(books: IBook[], changed = true) {
    await this._write('books.json', serializeBooks(books));
    if (changed) { await this._pending(); }
  }

  private async _readRemote(path: string) {
    try {
      const response = await this._client.getFileContents(this._remotePath(path), {format: 'text', details: true}) as any;
      return {value: JSON.parse(typeof response === 'string' ? response : response.data),
        etag: response.headers?.etag || response.headers?.ETag};
    } catch (error) {
      if (error.status === 404 || error.response?.status === 404) { return {value: undefined, etag: undefined}; }
      throw error;
    }
  }

  private async _putRemote(path: string, value: any, previous: {value: any, etag?: string}) {
    const headers = previous.etag ? {'If-Match': previous.etag} :
      previous.value === undefined ? {'If-None-Match': '*'} : {};
    await this._client.putFileContents(this._remotePath(path), JSON.stringify(value), {overwrite: true, headers});
  }

  private _isConflict(error: any) { return (error.status || error.response?.status) === 412; }

  public async syncBooks(books: IBook[], onUpdate: (info: string) => void = () => {}): Promise<IBook[]> {
    await this.saveBooks(books, false);
    if (!this.connected) { return books; }
    return this._runSync(() => this._syncLibrary(books, onUpdate));
  }

  public async syncAllBooks(books: IBook[], onUpdate: (info: string) => void = () => {}): Promise<IBook[]> {
    return this._runSync(async () => {
      this._publish({allBooksPending: true});
      await this._saveState();
      if (!this.connected) { throw new Error('请连接 WebDAV 后同步全部书籍。'); }
      await this.saveBooks(books, false);
      onUpdate('同步所有书架的书目和封面…');
      // The entire operation shares one queue entry, so success is only reported
      // after all configs and EPUBs have been processed.
      await this._syncLibrary(books, onUpdate, false);
      const active = books.filter(book => !book.removed);
      const failures: string[] = [];
      for (let index = 0; index < active.length; index++) {
        const book = active[index];
        const update = (message: string) => onUpdate(`[${index + 1}/${active.length}] ${message}`);
        try {
          update(`同步《${book.name}》的笔记和阅读进度…`);
          await this._syncBookNow(book);
          update(`下载《${book.name}》到本机（已下载则跳过）…`);
          await this.checkAndDownloadBook(book, update);
        } catch (error) {
          failures.push(`《${book.name}》：${error.message || error}`);
        }
      }
      if (failures.length) {
        throw new Error(`全部同步未完成：成功 ${active.length - failures.length}/${active.length} 本。已下载的书籍已保留，重试会跳过已有文件。\n${failures.join('\n')}`);
      }
      this._publish({allBooksPending: false});
      onUpdate(`全部同步完成：${active.length} 本书已可离线阅读。`);
      return [...books];
    });
  }

  private async _syncLibrary(books: IBook[], onUpdate: (info: string) => void, syncPending = true): Promise<IBook[]> {
    const revision = this._state.libraryPending;
    let merged: IBook[];
    for (let attempt = 0; attempt < 3; attempt++) {
      const previous = await this._readRemote('books.json');
      if (previous.value === undefined) { throw new Error('远端 books.json 索引已丢失，请恢复后重试。'); }
      const remote = validateBooks(previous.value);
      const remoteTable = new Map(remote.map(book => [book.hash, book]));
      merged = mergeBooks(books, remote);
      for (const book of merged) {
        const remoteBook = remoteTable.get(book.hash);
        const epubPath = `${book.hash}/${book.name}.epub`;
        if (book.removed) {
          if (await bk.worker.fs.exists(epubPath, 'Books')) { await bk.worker.fs.removeFile(epubPath, 'Books'); }
          if (remoteBook && !remoteBook.removed && await this._client.exists(this._remoteEpubPath(remoteBook))) {
            await this._client.deleteFile(this._remoteEpubPath(remoteBook));
          }
          continue;
        }
        if (!(await bk.worker.fs.exists(book.hash, 'Books'))) { await bk.worker.fs.createDir(book.hash, 'Books'); }
        if (!remoteBook || remoteBook.removed || book.ts > remoteBook.ts) {
          if (!(await this._client.exists(this._remotePath(book.hash)))) { await this._client.createDirectory(this._remotePath(book.hash)); }
          for (const filename of [`${book.name}.epub`, 'cover.png', 'config.json']) {
            const path = `${book.hash}/${filename}`;
            if (filename === 'config.json' && await this._client.exists(this._remotePath(path))) { continue; }
            if (await bk.worker.fs.exists(path, 'Books')) {
              onUpdate(`上传《${book.name}》的 ${filename}...`);
              if (filename === `${book.name}.epub` && !book.remoteFile) {
                const safeName = safeRemoteEpubFile(book.name);
                if (safeName !== filename) { book.remoteFile = safeName; }
              }
              const destination = filename === `${book.name}.epub` ? this._remoteEpubPath(book) : this._remotePath(path);
              await this._client.putFileContents(destination, await bk.worker.fs.readFile(path, 'binary', 'Books'), {overwrite: true});
            }
          }
        }
        await this._writeWithCheck(book, 'config.json', onUpdate);
        if (!(await bk.worker.fs.exists(`${book.hash}/cover.png`, 'Books')) &&
          await this._client.exists(this._remotePath(`${book.hash}/cover.png`))) {
          await this._writeWithCheck(book, 'cover.png', onUpdate);
        }
        await fillBookCover(book);
      }
      try {
        onUpdate('同步书目和书架...');
        await this._putRemote('books.json', JSON.parse(serializeBooks(merged)), previous);
        break;
      } catch (error) {
        if (!this._isConflict(error) || attempt === 2) { throw error; }
      }
    }
    books.splice(0, books.length, ...merged);
    await this.saveBooks(books, false);
    this._publish({bookCount: books.filter(book => !book.removed).length});
    if (revision === this._state.libraryPending) { this._publish({libraryPending: 0}); }
    for (const hash of Object.keys(this._state.pendingBooks)) {
      const book = books.find(item => item.hash === hash);
      if (book && !book.removed) {
        if (syncPending) {
          onUpdate(`同步《${book.name}》的笔记和进度...`);
          await this._syncBookNow(book);
        }
      } else {
        const pendingBooks = {...this._state.pendingBooks};
        delete pendingBooks[hash];
        this._publish({pendingBooks});
      }
    }
    return [...books];
  }

  private async _writeWithCheck(book: IBook, filename: string, onUpdate?: (info: string) => void): Promise<ArrayBuffer | string> {
    const path = `${book.hash}/${filename}`;
    if (await bk.worker.fs.exists(path, 'Books')) { return undefined; }
    if (!this.connected) { throw new Error('书籍未下载，请连接服务器后下载。'); }
    const source = filename === `${book.name}.epub` ? this._remoteEpubPath(book) : this._remotePath(path);
    const data = await this._client.getFileContents(source, {
      format: /json$/.test(filename) ? 'text' : 'binary',
      onDownloadProgress: ({loaded, total}) => onUpdate?.(`下载《${book.name}》${total ? ` ${Math.floor(loaded / total * 100)}%` : '...'}`)
    });
    await this._write(path, data as ArrayBuffer | string);
    return data as ArrayBuffer | string;
  }

  public async isDownloaded(book: IBook) {
    return bk.worker.fs.exists(`${book.hash}/${book.name}.epub`, 'Books');
  }

  async checkAndDownloadBook(book: IBook, onUpdate: (info: string) => void = () => {}): Promise<ArrayBuffer> {
    return await this._writeWithCheck(book, `${book.name}.epub`, onUpdate) as ArrayBuffer;
  }

  async loadBook(book: IBook): Promise<IBookContent> {
    await this._writes;
    let config = JSON.parse(await bk.worker.fs.readFile(`${book.hash}/config.json`, 'utf8', 'Books') as string);
    try { config = await this.syncBook(book); } catch (error) { /* The local copy remains readable. */ }
    const pages = await bk.worker.fs.exists(`${book.hash}/pages.json`, 'Books') ?
      await bk.worker.fs.readFile(`${book.hash}/pages.json`, 'utf8', 'Books') as string : undefined;
    return {content: await bk.worker.fs.readFile(`${book.hash}/${book.name}.epub`, 'binary', 'Books') as ArrayBuffer,
      config: {...config, ts: config.ts || 0, lastProgress: config.lastProgress ?? config.progress}, pages};
  }

  async savePages(book: IBook, pages: string[]) {
    await this._write(`${book.hash}/pages.json`, JSON.stringify(pages));
  }

  public async syncBook(book: IBook, config?: IBookConfig): Promise<IBookConfig> {
    if (config) { await this.saveConfig(book, config); }
    await this._writes;
    if (!this.connected) {
      return JSON.parse(await bk.worker.fs.readFile(`${book.hash}/config.json`, 'utf8', 'Books') as string);
    }
    return this._runSync(() => this._syncBookNow(book));
  }

  private async _syncBookNow(book: IBook): Promise<IBookConfig> {
    const path = `${book.hash}/config.json`;
    await this._writes;
    const revision = this._state.pendingBooks[book.hash];
    for (let attempt = 0; attempt < 3; attempt++) {
      const previous = await this._readRemote(path);
      const local = JSON.parse(await bk.worker.fs.readFile(path, 'utf8', 'Books') as string);
      const config = previous.value ? mergeConfig(local, previous.value) : local;
      if (!previous.value && !(await this._client.exists(this._remotePath(book.hash)))) {
        await this._client.createDirectory(this._remotePath(book.hash));
      }
      try {
        await this._putRemote(path, config, previous);
        await this._writes;
        const latest = JSON.parse(await bk.worker.fs.readFile(path, 'utf8', 'Books') as string);
        const result = mergeConfig(latest, config);
        await this._write(path, JSON.stringify(result));
        if (revision === this._state.pendingBooks[book.hash]) {
          const pendingBooks = {...this._state.pendingBooks};
          delete pendingBooks[book.hash];
          this._publish({pendingBooks});
        }
        return result;
      } catch (error) {
        if (!this._isConflict(error) || attempt === 2) { throw error; }
      }
    }
    throw new Error('同步冲突，请重试。');
  }

  public async syncBookshelf(books?: IBook[]): Promise<Array<string | null>> {
    books = books || JSON.parse(await bk.worker.fs.readFile('books.json', 'utf8', 'Books') as string);
    await this.saveBooks(books);
    const merged = await this.syncBooks(books);
    return merged.filter(book => !book.removed).map(book => book.bookshelf?.value || null);
  }

  public async saveConfig(book: IBook, config: IBookConfig) {
    await this._write(`${book.hash}/config.json`, JSON.stringify(config));
    await this._pending(book.hash);
  }

  public async setBookToTop(books: IBook[], index: number) {
    const book = books[index];
    books.splice(index, 1);
    books.splice(0, 0, book);
    await this.saveBooks(books, false);
  }

  public async addBook(fp: string, books: IBook[], allowAnotherEdition = false): Promise<IBook[]> {
    const {fs} = bk.worker;
    const epub = ePub();

    try {
      const content = await fs.readFile(fp, 'binary', 'None') as ArrayBuffer;
      const hash = md5.hex(content);
      const book = books.find(b => b.hash === hash);
      if (book && !book.removed) {
        throw new DuplicateBookError({file: fp, name: book.name, author: book.author, matches: [book], identical: true});
      }
      try {
        await epub.open(content);
      } catch (error) {
        throw new Error(`书籍无法解析：${fp}`);
      }

      const metadata = await epub.loaded.metadata;
      const name = metadata.title;
      if (!name || /[\\/\u0000]/.test(name)) { throw new Error('书名为空或包含不支持的路径字符。'); }
      const author = metadata.creator;
      const matches = findMatchingBooks(books, {name, author});
      if (matches.length && !allowAnotherEdition) {
        throw new DuplicateBookError({file: fp, name, author, matches, identical: false});
      }
      const coverUrl = await epub.coverUrl();
      let cover: ArrayBuffer;
      if (coverUrl) {
        cover = await (await fetch(coverUrl)).arrayBuffer();
      }

      if (!book) {
        !(await fs.exists(hash, 'Books')) && await fs.createDir(hash, 'Books');
        await fs.writeFile(`${hash}/config.json`, '{"ts":0,"lastProgress":0,"progress":0,"notes":[],"bookmarks":[]}', 'Books');
        await fs.writeFile(`${hash}/${name}.epub`, content, 'Books');
        cover && await fs.writeFile(`${hash}/cover.png`, cover, 'Books');
        books.splice(0, 0, {
          hash,
          type: 'EPUB',
          name,
          author,
          cover: coverUrl,
          ts: Date.now()
        });
      } else if (book.removed) {
        await fs.writeFile(`${hash}/${name}.epub`, content, 'Books');
        cover && await fs.writeFile(`${hash}/cover.png`, cover, 'Books');
        delete book.removed;
        book.ts = Date.now();
      }
      await fillBookCover(books.find(item => item.hash === hash));
    } catch (error) {
      throw error;
    } finally {
      // open() resolves before navigation parsing finishes. In particular, an
      // early duplicate return must not destroy the parser while that callback
      // still needs its loading state. Cleanup does not hold up the next file.
      if (epub.isOpen) { void epub.ready.then(() => epub.destroy(), () => epub.destroy()); }
      else { epub.destroy(); }
    }

    await this.saveBooks(books);
    return books;
  }

  public async removeBook(book: IBook, books: IBook[]): Promise<IBook[]> {
    const {fs} = bk.worker;

    for (const name of [`${book.name}.epub`, 'cover.png']) {
      const fp = `${book.hash}/${name}`;
      if (!(await fs.exists(fp, 'Books'))) {
        continue;
      }

      await fs.removeFile(fp, 'Books');
    }

    book.removed = true;
    book.ts = Date.now();
    await this.saveBooks(books);

    return books;
  }

  public async importNotes(book: IBook, filePath: string, onUpdate: (info: string) => void) {
    const {fs, showMessage} = bk.worker;
    const dom = document.createElement('html');
    dom.innerHTML = await bk.worker.fs.readFile(filePath, 'utf8', 'None') as string;

    onUpdate('校验书籍和笔记一致性...');
    let title = dom.querySelector('div.bookTitle')?.textContent?.trim();
    if (!title) {
      throw new Error('不是合法的Kindle笔记文件！');
    }

    title = title.slice(1, title.length - 1);
    if (title !== book.name) {
      throw new Error(`文件为《${title}》的笔记，和书籍《${book.name}》不匹配！`);
    }

    const bookFp = `${book.hash}/${book.name}.epub`;
    let content = await this.checkAndDownloadBook(book, onUpdate);
    if (!content) {
      content = await fs.readFile(bookFp, 'binary', 'Books') as ArrayBuffer;
    }

    const epub = ePub();
    try {
      await epub.open(content);
      await epub.ready;

      let pages: string;
      if (await fs.exists(`${book.hash}/pages.json`, 'Books')) {
        pages = await fs.readFile(`${book.hash}/pages.json`, 'utf8', 'Books') as string;
        epub.locations.load(pages);
      } else {
        onUpdate('首次生成书籍分页中...');
        const ps = await epub.locations.generate(600);
        pages = JSON.stringify(ps);
        await this.savePages(book, ps);
      }

      const metaInfos = dom.querySelectorAll('h3.noteHeading');
      const metaNotes = [...dom.querySelectorAll('div.noteText')].map(note => note.childNodes[0]);
      const notes: IBookNote[] = [];

      onUpdate(`检测到 ${metaInfos.length} 条标注或笔记，准备分析...`);

      const failed: string[] = [];
      let i: number = 0;
      let section: number = 0;
      let firstNode: Node;
      const preparedHash = dom.querySelector('div.bookTitle')?.getAttribute('data-awaken-book-md5');
      while (i < metaInfos.length) {
        const info = metaInfos[i].textContent;
        let text = metaNotes[i].textContent;
        let annotation: string = '';

        const nextInfo = metaInfos[i + 1]?.textContent;
        if (nextInfo?.startsWith('备注')) {
          annotation = metaNotes[i + 1].textContent;
        }

        if (nextInfo) {
          text = text.replace(nextInfo, '').trim();
          const nn = metaInfos[i + 2]?.textContent;

          if (annotation && nn) {
            annotation = annotation.replace(nn, '');
          }
        }

        text = text.replace(/\s+/g, '');

        const cfiHint = preparedHash === book.hash ? metaInfos[i].getAttribute('data-awaken-cfi') : undefined;
        const res = await searchFirstInBook(text, epub, section, firstNode, {cfi: cfiHint});
        section = res.section;
        firstNode = res.endNode;
        if (res.cfi) {
          const cfi = res.cfi;
          const [start, end] = splitCFI(cfi);

          notes.push({
            cfi, start, end,
            page: epub.locations.locationFromCfi(cfi) as unknown as number,
            text, annotation,
            modified: Date.now()
          });
        } else {
          failed.push(`${info}标注：${text}${annotation ? '笔记：' + annotation : ''}\n`);
        }

        i += annotation ? 2 : 1;
        onUpdate(`分析进度 ${i} / ${metaInfos.length} 条...`);
      }

      onUpdate(`分析完成，准备和已存在的笔记合并...`);

      const fp = `${book.hash}/config.json`;
      const config = JSON.parse(await fs.readFile(fp, 'utf8', 'Books') as string) as IBookConfig;
      config.removedTs = {...config.removedTs};
      config.notes = mergeImportedNotes(config.notes || [], notes, config.removedTs);
      await this.saveConfig(book, config);

      if (!this._client) {
        showMessage('服务器未连接，暂不同步到远端...', 'warning');
        return failed;
      }

      try {
        onUpdate(`合并完成，同步到远端...`);
        await this.syncBook(book, config);
      } catch (error) {
        showMessage('同步到远端失败，请手动重试...', 'error');
      }

      return failed;
    } finally {
      epub.destroy();
    }
  }
}

export default new WebDAV();
