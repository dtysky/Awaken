/**
 * @File   : webdav.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/11/15 22:54:37
 */
import {createClient, WebDAVClient, FileStat} from 'webdav/web';
import ePub, {EpubCFI} from 'epubjs';
import * as md5 from 'js-md5';

import bk from '../backend';
import {IBook, IBookConfig, IBookNote} from '../interfaces/protocols';
import {fillBookCover, searchFirstInBook} from './utils';
import {ISystemSettings} from '../interfaces';
import { splitCFI } from './reader/common';

export interface IBookContent {
  content: ArrayBuffer;
  config: IBookConfig;
  // generate once then save to local
  pages?: string;
}

const parser = new EpubCFI() as any;

function getRemote(fp: string) {
  return `Awaken/${fp}`;
}

class WebDAV {
  private _client: WebDAVClient;
  private _folder: string;
  private _connectWarnShowed: boolean = false;

  get connected() {
    return !!this._client;
  }

  public async changeRemote(options: ISystemSettings['webDav']) {
    this._client = createClient(
      `${bk.davPrefix}${options.url}`,
      {
        username: options.user,
        password: options.password
      }
    );

    try {
      const hasBookIndexes = await this._client.exists('Awaken');
      if (!hasBookIndexes) {
        await this._client.createDirectory('Awaken');
        await this._client.putFileContents(getRemote('books.json'), '[]');
      }
    } catch (error) {
      console.error(error)
      this._client = undefined;
      bk.worker.showMessage(`无法连接已保存的服务器，请检查`, 'warning');
    }
  }

  public async changeLocal(folder: string, onUpdate?: (info: string) => void) {
    if (!this._folder) {
      this._folder = folder;
      return;
    }

    if (this._folder === folder) {
      return;
    }

    onUpdate('开始迁移本地书籍...');
    const {fs} = bk.worker;
    const tree = await fs.readDir('', 'Books');
    
    for (const sub of tree) {
      if (!sub.isDir) {
        fs.writeFile(`${folder}/${sub.path}`, await fs.readFile(sub.path, 'binary', 'Books'), 'None');
        continue;
      }

      await fs.createDir(`${folder}/${sub.path}`, 'None');
      const subTree = await fs.readDir(sub.path, 'Books');

      for (const {isDir, path} of subTree) {
        // 最多两级
        if (isDir) {
          continue;
        }

        /\.epub$/.test(path) && onUpdate(`迁移书籍《${path}》...`);
        fs.writeFile(`${folder}/${sub.path}/${path}`, await fs.readFile(`${sub.path}/${path}`, 'binary', 'Books'), 'None');
      }
    }
  }

  public async syncBooks(books: IBook[], onUpdate: (info: string) => void): Promise<IBook[]> {
    const {fs} = bk.worker;

    if (!this._client) {
      bk.worker.showMessage('服务器未连接，无法同步', 'warning');
      return books;
    }

    let remoteBooks: IBook[] = [];
    const tmp = await this._client.getFileContents(getRemote('books.json'), {format: 'text'}) as string;
    remoteBooks = JSON.parse(tmp);
    
    const localTable: {[hash: string]: IBook} = {};
    const remoteTable: {[hash: string]: IBook} = {};

    books.forEach(book => localTable[book.hash] = book);
    remoteBooks.forEach(book => remoteTable[book.hash] = book);

    const syncToLocalBooks: IBook[] = [];
    remoteBooks.forEach(book => {
      const localBook = localTable[book.hash];
      if (
        (localBook && (book.ts > localBook.ts)) ||
        (!localBook && !book.removed)
      ) {
        syncToLocalBooks.push(book);
      }
    });

    const syncToRemoteBooks: IBook[] = [];
    books.forEach(book => {
      const remoteBook = remoteTable[book.hash];
      if (
        (remoteBook && (book.ts > remoteBook.ts)) ||
        (!remoteBook && !book.removed)
      ) {
        syncToRemoteBooks.push(book);
      }
    });

    if (syncToLocalBooks.length) {
      onUpdate(`检测到远端新书籍 ${syncToLocalBooks.length} 本，准备同步到本地...`);
      for (const book of syncToLocalBooks) {
        const localBook = localTable[book.hash];
        if (book.removed) {
          onUpdate(`移除本地书籍 ${book.name}...`);
          await this.removeBook(localBook, books);
          localBook.ts = book.ts;
          continue;
        }

        const contents = await this._client.getDirectoryContents(getRemote(book.hash)) as FileStat[];
        if (!(await fs.exists(book.hash, 'Books'))) {
          await fs.createDir(book.hash, 'Books');
        }
        
        for (const stat of contents) {
          // 这里只同步目录配置和封面，书籍等到加载时在真正下载！
          if (stat.type !== 'file') {
            continue;
          }
          !/\.epub$/.test(stat.basename) && await this._writeWithCheck(book, stat.basename, onUpdate);
        }
  
        await fillBookCover(book);
        if (!localBook) {
          books.splice(0, 0, book);
        } else {
          localBook.ts = book.ts;
          delete localBook.removed;
        }
      }
    }

    let booksStr = JSON.stringify(books);
    await fs.writeFile('books.json', booksStr, 'Books');

    if (syncToRemoteBooks.length) {
      try {
        onUpdate(`检测到本地新书籍 ${syncToRemoteBooks.length} 本，准备同步到远端...`);
        for (const book of syncToRemoteBooks) {
          if (book.removed) {
            onUpdate(`删除远端书籍 ${book.name}...`);
            await this._client.deleteFile(getRemote(`${book.hash}/${book.name}.epub`));
            continue;
          }

          if (!(await this._client.exists(getRemote(book.hash)))) {
            await this._client.createDirectory(getRemote(book.hash));
          }
  
          for (const name of [`${book.name}.epub`, 'cover.png', 'config.json']) {
            const fp = `${book.hash}/${name}`;
            if (!(await fs.exists(fp, 'Books'))) {
              continue;
            }

            const data = await fs.readFile(fp, 'binary', 'Books');
            await this._client.putFileContents(getRemote(fp), data, {overwrite: name !== 'config.json', onUploadProgress: ({loaded, total}) => {
              onUpdate(`同步书籍 ${book.name} 的 ${name} 到远端：${~~(loaded / total * 100)}%`);
            }});
          }
        }
    
        booksStr = JSON.stringify(books);
        await fs.writeFile('books.json', booksStr, 'Books');
        await this._client.putFileContents(getRemote('books.json'), booksStr, {overwrite: true, onUploadProgress: ({loaded, total}) => {
          onUpdate(`同步目录到远端：${~~(loaded / total * 100)}%`);
        }});
        await fs.writeFile('books.json', booksStr, 'Books');
      } catch (error) {
        console.error(error)
        bk.worker.showMessage(`同步到远端出错，可手动再次发起同步！`, 'warning');
      } 
    }

    return books;
  }

  private async _writeWithCheck(book: IBook, filename: string, onUpdate?: (info: string) => void): Promise<ArrayBuffer | string> {
    const {fs} = bk.worker;
    const fp = `${book.hash}/${filename}`;
    const existed = await fs.exists(fp, 'Books');

    if (existed) {
      return undefined;
    }

    const tmp = await this._client.getFileContents(getRemote(fp), {format: /json$/.test(filename) ? 'text' : 'binary', onDownloadProgress: ({loaded, total}) => {
      onUpdate?.(`拉取书籍 ${book.name} 的 ${filename} 到本地：${~~(loaded / total * 100)}%`);
    }});
    await fs.writeFile(fp, tmp as ArrayBuffer, 'Books');

    return tmp as ArrayBuffer | string;
  }

  async checkAndDownloadBook(book: IBook, onUpdate: (info: string) => void): Promise<ArrayBuffer> {
    const bookFp = `${book.hash}/${book.name}.epub`;

    if (!(await bk.worker.fs.exists(bookFp, 'Books')) && !this.connected) {
      throw new Error('书籍未下载并且未连接到服务器，请先连接服务器');
    };

    try {
      return await this._writeWithCheck(book, `${book.name}.epub`, onUpdate) as ArrayBuffer;
    } catch (error) {
      throw new Error(`书籍下载出错：${error.message || error}`);
    }
  }
  
  async loadBook(book: IBook): Promise<IBookContent> {
    const {fs} = bk.worker;
    const bookFp = `${book.hash}/${book.name}.epub`;

    const config = await this.syncBook(book);
    const pages = await fs.exists(`${book.hash}/pages.json`, 'Books') &&
      await fs.readFile(`${book.hash}/pages.json`, 'utf8', 'Books') as string;

    return {
      content: await fs.readFile(bookFp, 'binary', 'Books') as ArrayBuffer,
      config, pages
    }
  }

  async savePages(book: IBook, pages: string[]) {
    return await bk.worker.fs.writeFile(`${book.hash}/pages.json`, JSON.stringify(pages), 'Books');
  }

  public async syncBook(book: IBook, config?: IBookConfig): Promise<IBookConfig> {
    if (!config) {
      config = JSON.parse(await bk.worker.fs.readFile(`${book.hash}/config.json`, 'utf8', 'Books') as string);
    }

    if (!this.connected) {
      if (!this._connectWarnShowed) {
        await bk.worker.showMessage('未连接到服务器时，仅使用本地笔记（仅提示一次）', 'info');
        this._connectWarnShowed = true;
      }
      return config;
    }

    const remote = JSON.parse(await this._client.getFileContents(getRemote(`${book.hash}/config.json`), {format: 'text'}) as string);
    config = this._mergeConfig(config, remote);
    
    await bk.worker.fs.writeFile(`${book.hash}/config.json`, JSON.stringify(config), 'Books');
    config.removedTs = remote.removedTs;
    await this._client.putFileContents(getRemote(`${book.hash}/config.json`), JSON.stringify(config), {overwrite: true});

    return config;
  }

  private _mergeConfig(local: IBookConfig, remote: IBookConfig): IBookConfig {
    const localTS = local.ts || Date.now();
    const remoteTS = remote.ts || Date.now();
    remote.removedTs = remote.removedTs || {};
    local.lastProgress = local.lastProgress || local.progress;
    remote.lastProgress = remote.lastProgress || remote.progress;
    local.ts = Math.max(localTS, remoteTS);
    local.lastProgress = localTS > remoteTS ? local.lastProgress : remote.lastProgress;
    local.notes = this._mergeNotes(local.notes, remote.notes, remote.removedTs);
    local.bookmarks = this._mergeNotes(local.bookmarks, remote.bookmarks, remote.removedTs);

    return local;
  }

  private _mergeNotes(localNotes: IBookNote[], remoteNotes: IBookNote[], removedTs: {[cfi: string]: number}): IBookNote[] {
    const res: IBookNote[] = [];
    let localIndex: number = 0;
    let remoteIndex: number = 0;
    let pre: IBookNote;
    let less: IBookNote;
    let preRemoved: IBookNote;

    while (localIndex < localNotes.length || remoteIndex < remoteNotes.length) {
      const local = localNotes[localIndex];
      const remote = remoteNotes[remoteIndex];

      const comp: number = !local ? 1 : !remote ? -1 : parser.compare(local.cfi, remote.cfi);
      if (comp === 1) {
        less = remote;
        remoteIndex += 1;
      } else {
        less = local;
        localIndex += 1;
      }

      // local
      if (less.removed) {
        removedTs[less.cfi] = Math.max(less.removed, removedTs[less.cfi] || 0);
        preRemoved = less;
        continue;
      }

      // remote
      if (preRemoved?.cfi === less.cfi) {
        if ((removedTs[less.cfi] || 0) > less.modified) {
          continue;
        }
      }

      // remote
      if (pre?.cfi === less.cfi) {
        pre.modified = Math.max(pre.modified, less.modified);
        continue;
      }

      if ((removedTs[less.cfi] || 0) > less.modified) {
        continue;
      }

      res.push(less);
      pre = less;
    }

    return res;
  }

  public async saveConfig(book: IBook, config: IBookConfig) {
    await bk.worker.fs.writeFile(`${book.hash}/config.json`, JSON.stringify(config), 'Books');
  }

  public async setBookToTop(books: IBook[], index: number) {
    const book = books[index];
    books.splice(index, 1);
    books.splice(0, 0, book);

    await bk.worker.fs.writeFile('books.json', JSON.stringify(books), 'Books');
  }

  public async addBook(fp: string, books: IBook[]): Promise<IBook[]> {
    const {fs} = bk.worker;
    const epub = ePub();

    try {
      const content = await fs.readFile(fp, 'binary', 'None') as ArrayBuffer;
      try {
        await epub.open(content);
      } catch (error) {
        throw new Error(`书籍无法解析：${fp}`);
      }

      const hash = md5.hex(content);
      
      const book = books.filter(b => b.hash === hash)[0];
      if (book && !book?.removed) {
        throw new Error(`书籍已存在：${fp}`);
      }

      const coverUrl = await epub.coverUrl();
      let cover: ArrayBuffer;
      if (coverUrl) {
        cover = await (await fetch(coverUrl)).arrayBuffer();
      }
      const metadata = await epub.loaded.metadata;
      const name = metadata.title;
      const author = metadata.creator;

      if (!book) {
        !(await fs.exists(hash, 'Books')) && await fs.createDir(hash, 'Books');
        await fs.writeFile(`${hash}/config.json`, '{"progress": 0,"notes": [],"bookmarks":[]}', 'Books');
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
    } catch (error) {
      throw error;
    } finally {
      epub.destroy();
    }

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

    return books;
  }

  public async importNotes(book: IBook, filePath: string, onUpdate: (info: string) => void) {
    const {fs} = bk.worker;
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
    console.log(dom);

    const bookFp = `${book.hash}/${book.name}.epub`;
    let content = await this.checkAndDownloadBook(book, onUpdate);
    if (!content) {
      content = await fs.readFile(bookFp, 'binary', 'Books') as ArrayBuffer;
    }

    const epub = ePub();
    await epub.open(content);

    const metaInfos = dom.querySelectorAll('h3.noteHeading');
    const metaNotes = dom.querySelectorAll('div.noteText');
    const notes: IBookNote[] = [];

    onUpdate(`检测到 ${metaInfos.length} 条标注或笔记，准备分析...`);

    let i: number = 0;
    let section: number = 0;
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
      const title = /- ([\s\S]+?) > 第/.exec(info)?.[1]

      console.log(title, text)
      const res = await searchFirstInBook(text, epub, title, section);
      if (res) {
        const cfi = res.cfi;
        const [start, end] = splitCFI(cfi);
        section = res.section;

        notes.push({
          cfi, start, end,
          text, annotation,
          modified: Date.now()
        });
        console.log('success', section)
      } else {
        // 收集起来，然后返回未导入的笔记，后面可以提示“以下笔记未能自动导入，请手动导入：”
        console.log('fail')
        section = 0;
      }

      i += annotation ? 2 : 1;
      onUpdate(`分析进度 ${i} / ${metaInfos.length} 条...`);
    }

    onUpdate(`分析完成，准备和已存在的笔记合并...`);
    console.log(notes);
  }
}

export default new WebDAV();
