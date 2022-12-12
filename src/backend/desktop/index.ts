/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:56
 */
import {fs, path, dialog, http, tauri} from '@tauri-apps/api';
import {proxy} from 'ajax-hook';

import {IWorker, TBaseDir, TToastType} from '../../interfaces/IWorker';
import {defaultThemes, ISystemSettings} from '../../interfaces';
import {DAV_PREFIX} from '../common';
import {IBook} from '../../interfaces/protocols';

let BOOKS_FOLDER: string;

function processPath(fp: string, base: TBaseDir): {base: number, fp: string, dir: () => Promise<string>;} {
  switch (base) {
    case 'Settings':
      return {base: fs.BaseDirectory.App, fp, dir: path.appDir};
    case 'Log':
      return {base: fs.BaseDirectory.Log, fp, dir: path.logDir};
    case 'Books':
      return {base: undefined, fp: `${BOOKS_FOLDER}/${fp}`, dir: () => new Promise(r => r(`${BOOKS_FOLDER}/`))};
    default:
      return {base: undefined, fp, dir: () => new Promise(r => r(''))};
  }
}

const SETTINGS_FP = processPath('settings.json', 'Settings');

export const worker: IWorker = {
  loadSettings: async () => {
    let settings: ISystemSettings;

    try {
      await fs.exists(SETTINGS_FP.fp, {dir: SETTINGS_FP.base});
      const txt = await fs.readTextFile(SETTINGS_FP.fp, {dir: SETTINGS_FP.base});
      settings = JSON.parse(txt);
    } catch (error) {
      settings = {
        folder: '',
        webDav: {
          url: '',
          user: '',
          password: ''
        },
        read: Object.assign({
          theme: 0,
          font: '',
          fontSize: 1,
          letterSpace: 0,
          lineSpace: 0.2
        }, defaultThemes[0])
      };

      const dp = await path.appDir();
      await fs.createDir(dp, {recursive: true});
      await fs.writeTextFile(SETTINGS_FP.fp, JSON.stringify(settings), {dir: SETTINGS_FP.base});
    }

    BOOKS_FOLDER = settings.folder;

    return settings;
  },
  async saveSettings(settings: ISystemSettings) {
    await fs.writeTextFile(SETTINGS_FP.fp, JSON.stringify(settings), {dir: SETTINGS_FP.base});
    BOOKS_FOLDER = settings.folder;
  },
  async selectFolder() {
    const selected = await dialog.open({
      title: '选择目录',
      directory: true
    });

    return selected as string;
  },
  async selectBook() {
    const selected = await dialog.open({
      title: '选择EPub书籍',
      multiple: true,
      filters: [{
        name: 'EPub',
        extensions: ['epub']
      }]
    });

    if (Array.isArray(selected)) {
      return selected;
    } else if (selected === null) {
      return [];
    } else {
      return [selected];
    }
  },
  async selectNote() {
    const selected = await dialog.open({
      title: '选择Kindle导出的笔记',
      multiple: true,
      filters: [{
        name: '笔记',
        extensions: ['html']
      }]
    });

    if (Array.isArray(selected)) {
      return selected;
    } else if (selected === null) {
      return [];
    } else {
      return [selected];
    }
  },
  async showMessage(msg: string, type: TToastType, title?: string) {
    await dialog.message(msg, {type, title});
  },
  async setBackground(r: number, g: number, b: number) {

  },
  onAppHide(callback: () => void) {

  },
  async getCoverUrl(book: IBook): Promise<string> {
    if (!(await worker.fs.exists(`${book.hash}/cover.png`, 'Books'))) {
      return '';
    }

    return tauri.convertFileSrc(`${BOOKS_FOLDER}/${book.hash}/cover.png`);
    // const content = await worker.fs.readFile(`${book.hash}/cover.png`, 'binary', 'Books') as ArrayBuffer;
    // return URL.createObjectURL(new Blob([content]));

  },
  fs: {
    async readFile(filePath: string, encoding: 'utf8' | 'binary', baseDir: TBaseDir) {
      const {fp, base} = processPath(filePath, baseDir);

      return encoding === 'utf8' ?
        fs.readTextFile(fp, base && {dir: base}) as Promise<string> :
        (await fs.readBinaryFile(fp, base && {dir: base})).buffer;
    },
    async writeFile(filePath: string, content: string | ArrayBuffer, baseDir: TBaseDir) {
      const {fp, base} = processPath(filePath, baseDir);

      return typeof content === 'string' ?
        fs.writeTextFile(fp, content, base && {dir: base}) :
        fs.writeBinaryFile(fp, content, base && {dir: base});
    },
    async removeFile(filePath: string, baseDir: TBaseDir) {
      const {fp, base} = processPath(filePath, baseDir);

      return fs.removeFile(fp, base && {dir: base});
    },
    async createDir(dirPath: string, baseDir: TBaseDir) {
      const {fp, base} = processPath(dirPath, baseDir);

      await fs.createDir(fp, {dir: base});
    },
    async removeDir(dirPath: string, baseDir: TBaseDir) {
      const {fp, base} = processPath(dirPath, baseDir);

      await fs.removeDir(fp, {dir: base});
    },
    async readDir(dirPath: string, baseDir: TBaseDir) {
      const {fp, base, dir} = processPath(dirPath, baseDir);

      const realBase = await dir();
      const list = await fs.readDir(fp, {dir: base, recursive: true});

      return list.map(entity => {
        return {
          path: entity.path.replace(realBase, '').replace(dirPath, ''),
          isDir: !!entity.children?.length
        };
      });
    },
    async exists(filePath: string, baseDir: TBaseDir) {
      const {fp, base} = processPath(filePath, baseDir);

      try {
        const res = await fs.exists(fp, base && {dir: base});
        return res as unknown as boolean;
      } catch (error) {
        return false;
      }
    }
  },
  logger: {} as any
};

// Make sure on client 'desktop'
if (!window['Awaken']) {
  proxy({
    onRequest: (config, handler) => {
      if (!config.url.startsWith(DAV_PREFIX)) {
        return handler.next(config);
      }

      const url = config.url.replace(DAV_PREFIX, '');

      http.fetch(url, {
        method: config.method as any,
        body: config.body ? (typeof config.body === 'string' ? http.Body.text(config.body) : http.Body.bytes(config.body)) : undefined,
        headers: config.headers,
        responseType: /(png|epub)$/.test(url) ? http.ResponseType.Binary : http.ResponseType.Text
      }).then(res => {
        handler.resolve({
          config: config,
          status: res.status,
          headers: {},
          response: res.data
        });
      }).catch(error => {
        handler.reject(error);
      });
    }
  });
}
