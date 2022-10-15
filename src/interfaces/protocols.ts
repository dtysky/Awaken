/**
 * @File   : protocols.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:44:34
 */
export type TBookType = 'EPUB' | 'MOBI' | 'PDF';

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
  // used in PDF
  page: number;
  // used in EPUB and MOBI
  cfi: string;
  start: number;
  // if zero, is bookmark
  length: number;
  // default to ''
  annotation: string;
}
