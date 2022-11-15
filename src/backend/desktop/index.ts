/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:56
 */
import {fs} from '@tauri-apps/api'
import {IWorker, TBaseDir} from '../../interfaces/IWorker';
import {ISystemSettings} from '../../interfaces';

let BOOKS_FOLDER: string;

function processPath(fp: string, base: TBaseDir): {base: number, fp: string} {
  switch (base) {
    case 'AppData':
      return {base: fs.BaseDirectory.Data, fp};
    case 'Log':
      return {base: fs.BaseDirectory.Log, fp};
    case 'Tmp':
      return {base: fs.BaseDirectory.Temp, fp};
    default:
      return {base: undefined, fp: `${BOOKS_FOLDER}/${fp}`};
  }

}

export const worker: IWorker = {
  loadSettings: async () => {
    BOOKS_FOLDER = 'H:/ComplexMind/Awaken/test';

    return {
      folder: BOOKS_FOLDER,
      webDav: {
        url: '',
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
    };
  },
  async saveSettings<TKey extends keyof ISystemSettings>(
    key: keyof ISystemSettings, value: ISystemSettings[TKey]
  ) {

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
        fs.writeTextFile(fp, content, base && {dir: base}):
        fs.writeBinaryFile(fp, content, base && {dir: base});
    },
    async removeFile(filePath: string, baseDir: TBaseDir) {
      const {fp, base} = processPath(filePath, baseDir);

      return fs.removeFile(fp, base && {dir: base});
    },
    async readDir(dirPath: string, baseDir: TBaseDir) {
      const {fp, base} = processPath(dirPath, baseDir);

      const list = await fs.readDir(fp, base && {dir: base});

      return list.map(entity => {
        return {
          path: entity.path,
          isDir: !!entity.children?.length
        };
      });
    },
    async exists(filePath: string, baseDir: TBaseDir) {
      const {fp, base} = processPath(filePath, baseDir);

      try {
        await fs.exists(fp, base && {dir: base}); 
        return true;
      } catch (error) {
        return false;
      }
    }
  },
  logger: {} as any
}
