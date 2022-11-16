/**
 * @File   : IWorker.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:02
 */
import {ISystemSettings} from './index';

export interface ILogger {
  info(...args: any): void;
  warn(...args: any): void;
  error(...args: any): void;
}

export type TBaseDir = 'Books' | 'Settings' | 'Tmp' | 'Log' | 'None';
export type TToastType = 'info' | 'warning' | 'error';

export interface IFileSystem {
  readFile(filePath: string, encoding: 'utf8' | 'binary', baseDir: TBaseDir): Promise<string | ArrayBuffer>;
  writeFile(filePath: string, content: string | ArrayBuffer, baseDir: TBaseDir): Promise<void>;
  removeFile(filePath: string, baseDir: TBaseDir): Promise<void>;
  readDir(dirPath: string, baseDir: TBaseDir): Promise<{path: string, isDir: boolean}[]>;
  exists(filePath: string, baseDir: TBaseDir): Promise<boolean>;
}

export interface IWorker {
  logger: ILogger;
  fs: IFileSystem;
  loadSettings(): Promise<ISystemSettings>;
  saveSettings(settings: ISystemSettings): Promise<void>;
  selectFolder(): Promise<string>;
  selectBook(): Promise<string[]>;
  showMessage(msg: string, type: TToastType, title?: string): Promise<void>;
}
