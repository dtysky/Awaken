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

  public async changeRemote(url: string, user: string, password: string): Promise<boolean> {
    this._client = createClient(
      url,
      {
        authType: AuthType.Digest,
        username: user,
        password: password
      }
    );

    console.log(await this._client.getDirectoryContents('/'));

    return false;
  }

  public changeLocal(folder: string) {

  }

  // public async syncBooks(books: IBook[]): IBook[] {

  // }

  // public async addBook(fp: string): IBook[] {

  // }

  // public async deleteBook(book: IBook): IBook[] {

  // }

  // public async syncBook(book: IBook): {
  //   book: IBook,
  //   config: IBookConfig
  // } {

  // }
}

export default new WebDAV();
