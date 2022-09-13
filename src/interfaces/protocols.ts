/**
 * @File   : protocols.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:44:34
 */
export interface IModifiedBooks {
  [hash: string]: boolean;
}

export interface IBooks {
  [hash: string]: {
    filePath: string;
    progress: number;
  };
}

// highlights and annotations
export interface IBookNotes {

}
