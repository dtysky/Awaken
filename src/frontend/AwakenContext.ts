/**
 * @File   : AwakenContext.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/18 13:34:29
 */
import * as React from 'react';

export interface IAwakenContext {
  folder: string;
  books: {
    name: string;
    author: string;
  }[];
}

const AwakenContext = React.createContext<IAwakenContext>({
  folder: '',
  books: []
});

export default AwakenContext;
