/**
 * @File   : webdav.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/11/15 22:54:37
 */
import {createClient, AuthType, WebDAVClient, FileStat} from 'webdav/web';
import ePub, {EpubCFI} from 'epubjs';
import * as md5 from 'js-md5';

import bk from '../backend';
import {IBook, IBookConfig, IBookNote} from '../interfaces/protocols';
import {fillBookCover} from './utils';
import { ISystemSettings } from '../interfaces';

export interface IBookContent {
  content: ArrayBuffer;
  config: IBookConfig;
  // generate once then save to local
  pages?: string;
}

const parser = new EpubCFI() as any;

class WebDAV {
  private _client: WebDAVClient;
  private _folder: string;
  private _hasBookIndexes: boolean = false;

  get connected() {
    return !!this._client;
  }

  public async changeRemote(options: ISystemSettings['webDav']) {
    this._client = createClient(
      options.url,
      {
        authType: AuthType.Digest,
        username: options.user,
        password: options.password
      }
    );

    try {
      this._hasBookIndexes = await this._client.exists('books.json');
    } catch (error) {
      this._client = undefined;
      bk.worker.showMessage('无法连接已保存的服务器，请检查', 'warning');
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
    if (this._hasBookIndexes) {
      const tmp = await this._client.getFileContents('books.json', {format: 'text'}) as string;
      remoteBooks = JSON.parse(tmp);
    }
    
    const localTable: {[hash: string]: IBook} = {};
    const remoteTable: {[hash: string]: IBook} = {};

    books.forEach(book => localTable[book.hash] = book);
    remoteBooks.forEach(book => remoteTable[book.hash] = book);

    const syncToLocalBooks: IBook[] = [];
    remoteBooks.forEach(book => {
      const localBook = localTable[book.hash];
      if (!localBook || (book.removed && !localBook.removed && !localBook.waitSync)) {
        syncToLocalBooks.push(book);
      }
    });

    const syncToRemoteBooks: IBook[] = [];
    books.forEach(book => {
      const remoteBook = remoteTable[book.hash];
      if (!remoteBook || (book.removed && !remoteBook.removed) || (remoteBook.removed && book.waitSync)) {
        syncToRemoteBooks.push(book);
      }
    });

    if (syncToLocalBooks.length) {
      onUpdate(`检测到远端新书籍 ${syncToLocalBooks.length} 本，准备同步到本地...`);
      for (const book of syncToLocalBooks) {
        if (book.removed) {
          onUpdate(`移除本地书籍 ${book.name}...`);
          await this.removeBook(localTable[book.hash], books);
          continue;
        }

        const contents = await this._client.getDirectoryContents(book.hash) as FileStat[];
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
        books.splice(0, 0, book);
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
            await this._client.deleteFile(`${`${book.hash}/${book.name}.epub`}`);
            continue;
          }

          if (!(await this._client.exists(book.hash))) {
            await this._client.createDirectory(book.hash);
          }
  
          for (const name of [`${book.name}.epub`, 'cover.png', 'config.json']) {
            const fp = `${book.hash}/${name}`;
            if (!(await fs.exists(fp, 'Books'))) {
              continue;
            }

            const data = await fs.readFile(fp, 'binary', 'Books');
            await this._client.putFileContents(fp, data, {overwrite: false, onUploadProgress: ({loaded, total}) => {
              onUpdate(`同步书籍 ${book.name} 的 ${name} 到远端：${~~(loaded / total * 100)}%`);
            }});
          }

          delete book.waitSync;
        }
    
        booksStr = JSON.stringify(books);
        await fs.writeFile('books.json', booksStr, 'Books');
        await this._client.putFileContents('books.json', booksStr, {overwrite: true, onUploadProgress: ({loaded, total}) => {
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

  private async _writeWithCheck(book: IBook, filename: string, onUpdate?: (info: string) => void) {
    const {fs} = bk.worker;
    const fp = `${book.hash}/${filename}`;
    const existed = await fs.exists(fp, 'Books');

    if (existed) {
      return;
    }

    const tmp = await this._client.getFileContents(fp, {format: 'binary', onDownloadProgress: ({loaded, total}) => {
      onUpdate?.(`拉取书籍 ${book.name} 的 ${filename} 到本地：${~~(loaded / total * 100)}%`);
    }});
    return await fs.writeFile(fp, tmp as ArrayBuffer, 'Books');
  }

  async checkAndDownloadBook(book: IBook): Promise<string> {
    const bookFp = `${book.hash}/${book.name}.epub`;

    if (!(await bk.worker.fs.exists(bookFp, 'Books')) && !this.connected) {
      return '书籍未下载并且未连接到服务器，请先连接服务器';
    };

    try {
      await this._writeWithCheck(book, `${book.name}.epub`);
      return '';
    } catch (error) {
      return `书籍未下载出错：${error.message || error}`;
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
      await bk.worker.showMessage('为连接到服务器，仅使用本地笔记', 'info');
      return config;
    }

    const remote = JSON.parse(await this._client.getFileContents(`${book.hash}/config.json`, {format: 'text'}) as string);
    config = this._mergeConfig(config, remote);
    
    const configStr = JSON.stringify(config);
    await bk.worker.fs.writeFile(`${book.hash}/config.json`, configStr, 'Books');
    await this._client.putFileContents(`${book.hash}/config.json`, configStr, {overwrite: true});

    return config;
  }

  private _mergeConfig(local: IBookConfig, remote: IBookConfig): IBookConfig {
    const localTS = local.ts || Date.now();
    const remoteTS = remote.ts || Date.now();
    local.lastProgress = local.lastProgress || local.progress;
    remote.lastProgress = remote.lastProgress || remote.progress;
    local.ts = Math.max(localTS, remoteTS);
    local.lastProgress = localTS > remoteTS ? local.lastProgress : remote.lastProgress;
    local.notes = this._mergeNotes(local.notes, remote.notes);
    local.bookmarks = this._mergeNotes(local.bookmarks, remote.bookmarks);

    return local;
  }

  private _mergeNotes(localNotes: IBookNote[], remoteNotes: IBookNote[]): IBookNote[] {
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

      if (less.removed) {
        preRemoved = less;
        continue;
      }

      if (pre?.cfi === less.cfi) {
        continue;
      }

      if (preRemoved?.cfi === less.cfi) {
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

      if (!(await fs.exists(hash, 'Books'))) {
        await fs.createDir(hash, 'Books');
        await fs.writeFile(`${hash}/config.json`, '{"progress": 0,"notes": [],"bookmarks":[]}', 'Books');
        await fs.writeFile(`${hash}/${name}.epub`, content, 'Books');
        cover && await fs.writeFile(`${hash}/cover.png`, cover, 'Books');
        books.splice(0, 0, {
          hash,
          type: 'EPUB',
          name,
          author,
          cover: coverUrl,
          waitSync: true
        });
      } else if (book.removed) {
        await fs.writeFile(`${hash}/${name}.epub`, content, 'Books');
        cover && await fs.writeFile(`${hash}/cover.png`, cover, 'Books');
        delete book.removed;
        book.waitSync = true;
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

    return books;
  }
}

export default new WebDAV();
