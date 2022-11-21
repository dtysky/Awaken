/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:56
 */
import {IWorker} from '../interfaces/IWorker';
import {worker as dWorker} from '../backend/desktop';
import {worker as nWorker} from '../backend/native';

// inject runtime
const isNative = !!window['Awaken'];

console.log(isNative)

const exp: {
  worker: IWorker,
  supportChangeFolder: boolean
} = {} as any;

if (isNative) {
  exp.worker = nWorker;
  exp.supportChangeFolder = false;
} else {
  exp.worker = dWorker;
  exp.supportChangeFolder = true;
}

export default exp;
