/**
 * @File   : webdav.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/11/15 22:54:37
 */
import {createClient, AuthType, WebDAVClient} from 'webdav/web';
import ePub from 'epubjs';
import * as md5 from 'js-md5';

import {IBook, IBookConfig} from '../interfaces/protocols';
import bk from '../backend';

export interface IBookContent {
  content: ArrayBuffer;
  config: IBookConfig;
}

class WebDAV {
  private _client: WebDAVClient;
  private _folder: string;

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
      await this._client.getDirectoryContents('/');
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

  public async syncBooks(books: IBook[]): Promise<IBook[]> {
    // 双端同步
    // 先拉取目录，和本地对比
    // 拉取远端，再上传本地
    // 上传合并后的目录，最后目录落地
    return books;
  }

  public async syncBook(book: IBook, config: IBookConfig): Promise<IBookConfig> {
    return config;
  }
  
  async loadBook(book: IBook): Promise<IBookContent> {
    // 先sync
    // book = await this.syncBook(book);

    return {
      content: await bk.worker.fs.readFile(`${book.hash}/${book.name}`, 'binary', 'Books') as ArrayBuffer,
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
      book.open(content);
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
        fs.writeFile(`${hash}/config.json`, '{"progress": 0}', 'Books');
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
    return books;
  }

  // public async syncBook(book: IBook): {
  //   book: IBook,
  //   config: IBookConfig
  // } {

  // }
}

export default new WebDAV();
