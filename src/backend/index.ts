/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:56
 */
import {IWorker} from '../interfaces/IWorker';

// inject runtime
// const platform = window['AWAKEN_PLATFORM'];
const platform: string = 'DESKTOP';

const exp: {worker: IWorker} = {} as any;

if (platform === 'DESKTOP') {
  exp.worker = {} as any;
} else if (platform === 'IOS') {
  exp.worker = {} as any;
} else if (platform === 'ANDROID') {
  exp.worker = {} as any;
} else {
  throw new Error(`Unknown Platform ${platform} !`);
}

export default exp;
