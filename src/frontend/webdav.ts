/**
 * @File   : webdav.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/11/15 22:54:37
 */
import {createClient, AuthType, WebDAVClient, FileStat} from 'webdav/web';
import ePub from 'epubjs';
import * as md5 from 'js-md5';

import {IBook, IBookConfig} from '../interfaces/protocols';
import bk from '../backend';
import { fillBookCover } from './utils';

export interface IBookContent {
  content: ArrayBuffer;
  config: IBookConfig;
}

class WebDAV {
  private _client: WebDAVClient;
  private _folder: string;
  private _hasBookIndexes: boolean = false;

  get connected() {
    return !!this._client;
  }

  public async changeRemote(url: string, user: string, password: string) {
    this._client = createClient(
      url,
      {
        authType: AuthType.Digest,
        username: user,
        password: password
      }
    );

    try {
      this._hasBookIndexes = await this._client.exists('books.json');
    } catch (error) {
      this._client = undefined;
      throw error;
    }
  }

  public async changeLocal(folder: string) {
    if (!this._folder) {
      this._folder = folder;
      return;
    }

    // copy from origin to new dest
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

    const localTable = new Set<string>();
    const remoteTable = new Set<string>();

    books.forEach(book => localTable.add(book.hash));
    remoteBooks.forEach(book => remoteTable.add(book.hash));

    const syncToLocalBooks: IBook[] = [];
    remoteBooks.forEach(book => {
      if (!localTable.has(book.hash)) {
        syncToLocalBooks.push(book);
      }
    });

    const syncToRemoteBooks: IBook[] = [];
    books.forEach(book => {
      if (!remoteTable.has(book.hash)) {
        syncToRemoteBooks.push(book);
      }
    });

    if (syncToLocalBooks.length) {
      onUpdate(`检测到远端新书籍 ${syncToLocalBooks.length} 本，准备同步到本地...`);
      for (const book of syncToLocalBooks) {
        const contents = await this._client.getDirectoryContents(book.hash) as FileStat[];
        if (!(await fs.exists(book.hash, 'Books'))) {
          await fs.createDir(book.hash, 'Books');
        }
        
        for (const stat of contents) {
          await this._writeWithCheck(book, stat.filename, onUpdate);
        }
  
        await fillBookCover(book);
        books.splice(0, 0, book);
      }
    }

    const booksStr = JSON.stringify(books);
    await fs.writeFile('books.json', booksStr, 'Books');

    if (syncToRemoteBooks.length) {
      try {
        onUpdate(`检测到本地新书籍 ${syncToRemoteBooks.length} 本，准备同步到远端...`);
        for (const book of syncToRemoteBooks) {
          if (!(await this._client.exists(book.hash))) {
            await this._client.createDirectory(book.hash);
          }
  
          for (const name of [`${book.name}.epub`, 'cover.png', 'config.json']) {
            const fp = `${book.hash}/${name}`;
            if (!(await fs.exists(fp, 'Books'))) {
              continue;
            }

            const data = await fs.readFile(fp, 'binary', 'Books');
            await this._client.putFileContents(fp, data, {overwrite: true, onUploadProgress: ({loaded, total}) => {
              onUpdate(`同步书籍 ${book.name} 的 ${name} 到远端：${~~(loaded / total * 100)}%`);
            }});
          }
        }
    
        await this._client.putFileContents('books.json', booksStr, {overwrite: true, onUploadProgress: ({loaded, total}) => {
          onUpdate(`同步目录到远端：${~~(loaded / total * 100)}%`);
        }});
      } catch (error) {
        console.error(error)
        bk.worker.showMessage(`同步到远端出错，可手动再次发起同步！`, 'warning');
      } 
    }

    return books;
  }

  public async syncBook(book: IBook, config: IBookConfig): Promise<IBookConfig> {
    return config;
  }

  private async _writeWithCheck(book: IBook, filename: string, onUpdate?: (info: string) => void) {
    const {fs} = bk.worker;
    const fp = `${book.hash}/${filename}`;
    const existed = await fs.exists(fp, 'Books');

    if (existed) {
      return;
    }

    const tmp = await this._client.getFileContents(fp, {format: 'binary', onDownloadProgress: ({loaded, total}) => {
      onUpdate(`拉取书籍 ${book.name} 的 ${filename} 到本地：${~~(loaded / total * 100)}%`);
    }});
    return await fs.writeFile(fp, tmp as ArrayBuffer, 'Books');
  }

  private async _mergeConfig(local: IBookConfig, remote: IBookConfig) {

  }
  
  async loadBook(book: IBook): Promise<IBookContent> {
    // 先sync
    // book = await this.syncBook(book);

    return {
      content: await bk.worker.fs.readFile(`${book.hash}/${book.name}.epub`, 'binary', 'Books') as ArrayBuffer,
      config: {
        progress: 0,
        bookmarks: [],
        notes: []
      }
    }
  }

  public async addBook(fp: string, books: IBook[]): Promise<IBook[]> {
    const {fs} = bk.worker;
    const book = ePub();

    try {
      const content = await fs.readFile(fp, 'binary', 'None') as ArrayBuffer;
      try {
        await book.open(content);
      } catch (error) {
        throw new Error(`书籍无法解析：${fp}`);
      }

      const hash = md5.hex(content);

      if (books.filter(b => b.hash === hash).length) {
        throw new Error(`书籍已存在：${fp}`);
      }

      const coverUrl = await book.coverUrl();
      let cover: ArrayBuffer;
      if (coverUrl) {
        cover = await (await fetch(coverUrl)).arrayBuffer();
      }
      const metadata = await book.loaded.metadata;
      const name = metadata.title;
      const author = metadata.creator;

      if (!(await fs.exists(hash, 'Books'))) {
        fs.createDir(hash, 'Books');
        fs.writeFile(`${hash}/${name}.epub`, content, 'Books');
        fs.writeFile(`${hash}/config.json`, '{"progress": 0,"notes": [],"bookmarks":[]}', 'Books');
        cover && fs.writeFile(`${hash}/cover.png`, cover, 'Books');
      }

      const b: IBook = {
        hash,
        type: 'EPUB',
        name,
        author,
        cover: coverUrl
      };

      books.splice(0, 0, b);
    } catch (error) {
      throw error;
    } finally {
      book.destroy();
    }

    return books;
  }

  public async removeBook(book: IBook, books: IBook[]): Promise<IBook[]> {
    // remove只是做标记，并不会真正remove
    return books;
  }
}

export default new WebDAV();
