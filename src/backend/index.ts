/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:56
 */
import {IWorker} from '../interfaces/IWorker';
import {worker as dWorker} from '../backend/desktop';
import {worker as nWorker, platform} from '../backend/native';
import {DAV_PREFIX} from './common';

// inject runtime
const isNative = !!window['Awaken'];

const exp: {
  worker: IWorker,
  supportChangeFolder: boolean,
  supportAddDeleteBook: boolean,
  davPrefix: string
} = {
  davPrefix: DAV_PREFIX
} as any;

if (isNative) {
  exp.worker = nWorker;
  exp.supportChangeFolder = false;
  exp.supportAddDeleteBook = platform === 'ANDROID';
} else {
  exp.worker = dWorker;
  exp.supportChangeFolder = true;
  exp.supportAddDeleteBook = true;
}

export default exp;
