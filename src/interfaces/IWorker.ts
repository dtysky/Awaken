/**
 * @File   : IWorker.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:02
 */
import {ISystemConfig} from './index';

export interface ILogger {
  info(...args: any): void;
  warn(...args: any): void;
  error(...args: any): void;
}

export interface IFileSystem {
  readText(fp: string): string;
}

export interface IWorker {
  logger: ILogger;
  fs: IFileSystem;
  loadConfig(): Promise<ISystemConfig>;
  saveConfig<TKey extends keyof ISystemConfig>(
    key: TKey, value: ISystemConfig[TKey]
  ): Promise<void>;
}
