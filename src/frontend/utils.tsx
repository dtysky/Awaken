/**
 * @File   : utils.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:18:24
 */
import bk from '../backend';
import {ISystemSettings} from '../interfaces';
import {IBook, IBookConfig, IBookNote} from '../interfaces/protocols';

export interface IConfig {
  settings: ISystemSettings;
  books: IBook[];
}

export async function loadConfig(): Promise<IConfig> {
  const settings = await bk.worker.loadSettings();
  console.log(settings)
  // todo: read books.json to compare

  return {
    settings: settings,
    books: [
      {
        hash: '1',
        type: 'EPUB',
        name: '二十九',
        author: '瞬光寂暗',
        cover: '',
        filePath: '二十九.epub',
        progress: 0
      },
      {
        hash: '2',
        type: 'EPUB',
        name: '我为什么写作',
        author: '瞬光寂暗',
        cover: '',
        filePath: '我为什么写作.epub',
        progress: 0
      },
      {
        hash: '3',
        type: 'EPUB',
        name: '乡土中国',
        author: '费孝通',
        cover: '',
        filePath: '乡土中国.epub',
        progress: 0
      }
    ]
  }
}

export async function saveSettings(settings: ISystemSettings) {
  
}

export async function saveBooks(folder: string, books: IBook[]) {

}

export interface IBookContent {
  content: ArrayBuffer;
  config: IBookConfig;
}

export async function loadBook(filePath: string): Promise<IBookContent> {
  return {
    content: await bk.worker.fs.readFile(filePath, 'binary', 'Books') as ArrayBuffer,
    config: {
      bookmarks: [],
      notes: []
    }
  }
}

export async function checkAuth(user: string, password: string): Promise<boolean> {
  return false;
}
