/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/11/20 23:11:56
 */
import {IWorker, TBaseDir, TToastType} from '../../interfaces/IWorker';
import {ISystemSettings} from '../../interfaces';
import {atob} from './utils';

const jsb = window['Awaken'];
const platform = jsb?.getPlatform() as 'ANDROID' | 'IOS';
const API_PREFIX = 'http://awaken.api';

interface IResponse {
  buffer: ArrayBuffer;
  text: string;
  json: any;
  void: void;
}

async function callAPI<T extends keyof IResponse>(
  type: T,
  method: string,
  params: {[key: string]: string},
  data?: ArrayBuffer | string
): Promise<IResponse[T]> {  
  if (data && platform === 'ANDROID') {
    if (typeof data !== 'string') {
      data = atob(data as ArrayBuffer);
    }

    return jsb[method](params.filePath, params.base, data);
  }

  const p = Object.keys(params).map(key => `${key}=${encodeURIComponent(params[key] ?? '')}`).join('&');
  const url = `${API_PREFIX}/${method}?${p}`;
  const res = await fetch(url, {
    method: data ? 'POST' : 'GET',
    cache: 'no-cache',
    body: data
  });

  if (res.statusText !== 'OK') {
    throw new Error(res.statusText);
  }

  if (type === 'json') {
    return res.json();
  }
  
  if (type === 'buffer') {
    return res.arrayBuffer() as any;
  }

  if (type === 'text') {
    return res.text() as any;
  }

  return undefined;
}

window['callAPI'] = callAPI;

export const worker: IWorker = {
  loadSettings: async () => {
    let settings: ISystemSettings;

    if (await worker.fs.exists('settings.json', 'Settings')) {
      const txt = await worker.fs.readFile('settings.json', 'utf8', 'Settings') as string;
      settings = JSON.parse(txt);
    } else {
      settings = {
        folder: 'unnecessary',
        webDav: {
          url: 'http://192.168.2.208:8888/dav',
          user: 'dtysky',
          password: '114514'
        },
        read: {
          font: '',
          fontSize: 16,
          lineSpace: 16,
          color: '#000',
          background: '#fff',
          light: 1
        }
      };

      await worker.fs.writeFile('settings.json', JSON.stringify(settings), 'Settings');
    }

    return settings;
  },
  async saveSettings(settings: ISystemSettings) {
    await worker.fs.writeFile('settings.json', JSON.stringify(settings), 'Settings');
  },
  async selectFolder() {
    // unnecessary in native
    return '';
  },
  async selectBook() {
    return new Promise(resolve => {
      window['Awaken_SelectFilesHandler'] = (files: string[]) => {
        resolve(files);
      }

      // mimeTypes: t1|t2...
      jsb.selectFiles('选择书籍', 'application/epub+zip');
    });
  },
  async showMessage(message: string, type: TToastType, title: string = '') {
    jsb.showMessage(message, type, title);
  },
  fs: {
    async readFile(filePath: string, encoding: 'utf8' | 'binary', base: TBaseDir) {
      const isBin = encoding !== 'utf8';

      return callAPI(
        isBin ? 'buffer': 'text',
        isBin ? 'readBinaryFile' : 'readTextFile',
        {filePath, base}
      );
    },
    async writeFile(filePath: string, content: string | ArrayBuffer, base: TBaseDir) {
      const isBin = typeof content !== 'string';

      callAPI(
        'void',
        isBin ? 'writeBinaryFile' : 'writeTextFile',
        {filePath, base},
        content
      );
    },
    async removeFile(filePath: string, base: TBaseDir) {
      return callAPI('void', 'removeFile', {filePath, base});
    },
    async createDir(dirPath: string, base: TBaseDir) {
      return callAPI('void', 'createDir', {dirPath, base});
    },
    async removeDir(dirPath: string, base: TBaseDir) {
      return callAPI('void', 'removeDir', {dirPath, base});
    },
    async readDir(dirPath: string, base: TBaseDir) {
      return callAPI('json', 'readDir', {dirPath, base});
    },
    async exists(filePath: string, base: TBaseDir) {
      return callAPI('json', 'exists', {filePath, base});
    }
  },
  logger: {} as any
}
