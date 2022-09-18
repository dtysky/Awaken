/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:56
 */
import {IWorker} from '../../interfaces/IWorker';
import {ISystemConfig} from '../../interfaces';

export const worker: IWorker = {
  loadConfig: async () => ({
    folder: 'H:\\ComplexMind\\Awaken\\test',
    webDav: {
      user: '',
      password: ''
    },
    read: {
      font: '',
      fontSize: 16,
      lineSpace: 16,
      background: '#fff',
      light: 1
    }
  }),
  async saveConfig<TKey extends keyof ISystemConfig>(
    key: keyof ISystemConfig, value: ISystemConfig[TKey]
  ) {},
  fs: {} as any,
  logger: {} as any
}
