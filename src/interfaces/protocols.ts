/**
 * @File   : protocols.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:44:34
 */
export type TBookType = 'EPUB';

export interface IBook {
  hash: string;
  type: TBookType;
  name: string;
  author: string;
  cover?: string;
  filePath: string;
  progress: number;
}

// highlights and annotations
export interface IBookNote {
  cfi: string;
  page: number;
  // for note
  text?: string;
  // default to ''
  annotation?: string;
}

export interface IBookConfig {
  bookmarks: IBookNote[];
  notes: IBookNote[];
}
