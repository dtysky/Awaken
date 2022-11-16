/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:56
 */
import {fs, path, dialog} from '@tauri-apps/api'
import {IWorker, TBaseDir, TToastType} from '../../interfaces/IWorker';
import {ISystemSettings} from '../../interfaces';

let BOOKS_FOLDER: string;

function processPath(fp: string, base: TBaseDir): {base: number, fp: string} {
  switch (base) {
    case 'Settings':
      return {base: fs.BaseDirectory.App, fp};
    case 'Log':
      return {base: fs.BaseDirectory.Log, fp};
    case 'Tmp':
      return {base: fs.BaseDirectory.Cache, fp: `com.dtysky.Awaken/${fp}`};
    case 'Books':
      return {base: undefined, fp: `${BOOKS_FOLDER}/${fp}`};
    default:
      return {base: undefined, fp};
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
    } catch(error) {
      settings = {
        folder: '',
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
  async showMessage(msg: string, type: TToastType, title?: string) {
    await dialog.message(msg, {type, title});
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
