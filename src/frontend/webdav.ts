/**
 * @File   : webdav.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/11/15 22:54:37
 */
import {createClient, AuthType, WebDAVClient} from 'webdav/web';
import {IBook, IBookConfig} from '../interfaces/protocols';

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
    return books;
  }

  // public async addBook(fp: string, books: IBook[]): IBook[] {

  // }

  // public async deleteBook(book: IBook, books: IBook[]): IBook[] {

  // }

  // public async syncBook(book: IBook): {
  //   book: IBook,
  //   config: IBookConfig
  // } {

  // }
}

export default new WebDAV();
