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
  ts: number;
  removed?: boolean;
  // 以下是在打开是自动拼接
  // 检查下`hash`目录下是否有cover
  cover?: string;
}

// highlights and annotations
export interface IBookNote {
  cfi: string;
  // cfi start
  start: string;
  // cfi start
  end: string;
  page: number;
  // for note
  text?: string;
  // default to ''
  annotation?: string;
  removed?: boolean;
}

export interface IBookConfig {
  ts: number;
  // remote
  lastProgress: number;
  // always local
  progress: number;
  bookmarks: IBookNote[];
  notes: IBookNote[];
}
