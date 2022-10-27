/**
 * @File   : utils.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:18:24
 */
import bk from '../backend';
import {IBook, IBookNote} from '../interfaces/protocols';
import { ENotesAction } from './reader/types';

export interface IConfig {
  folder: string;
  books: IBook[];
}

export async function loadConfig(): Promise<IConfig> {
  const config = await bk.worker.loadConfig();
  console.log(config)
  // todo: read books.json to compare

  return {
    folder: config.folder,
    books: [
      {
        hash: '1',
        type: 'MOBI',
        name: '二十九',
        author: '瞬光寂暗',
        cover: '',
        filePath: '二十九.mobi',
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
        type: 'PDF',
        name: '乡土中国',
        author: '费孝通',
        cover: '',
        filePath: '乡土中国.pdf',
        progress: 0
      }
    ]
  }
}

export async function saveBooks(folder: string, books: IBook[]) {

}

export interface IBookContent {
  content: ArrayBuffer;
  notes: IBookNote[];
}

export async function loadBook(filePath: string): Promise<IBookContent> {
  return {
    content: await bk.worker.fs.readFile(filePath, 'binary', 'Books') as ArrayBuffer,
    notes: []
  }
}

// export function checkNoteMark(notes: IBookNote[], pos: string | number): number {

// }

// export function requestNoteMark(notes: IBookNote[], action: ENotesAction, note: IBookNote): IBookNote[] {

// }
