/**
 * @File   : utils.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:18:24
 */
import bk from '../backend';
import {ISystemSettings} from '../interfaces';
import {IBook, IBookConfig, IBookNote} from '../interfaces/protocols';

export interface IConfig {
  settings: ISystemSettings;
  books: IBook[];
}

export async function loadSettings(): Promise<ISystemSettings> {
  const settings = await bk.worker.loadSettings();
  console.log(settings)

  return settings;
}

export async function saveSettings(settings: ISystemSettings) {
  return bk.worker.saveSettings(settings);
}

export async function loadBooks() {
  let books: IBook[] = [];
  try {
    const txt = await bk.worker.fs.readFile('books.json', 'utf8', 'Books') as string;
    books = JSON.parse(txt);
  } catch (error) {
    await bk.worker.fs.writeFile('books.json', '[]', 'Books');
  }

  for (const book of books) {
    await fillBookCover(book); 
  }

  return books;
}

export async function fillBookCover(book: IBook) {
  book.cover = await bk.worker.getCoverUrl(book);
}

export async function selectFolder(requireRes: boolean): Promise<string> {
  const folder = await bk.worker.selectFolder();

  if (!folder && !requireRes) {
    return folder;
  }

  const content = await bk.worker.fs.readDir(folder, 'None');

  if (content?.length) {
    await bk.worker.showMessage('目录非空，请重新选择！', 'error');
    return selectFolder(requireRes);
  }

  return folder;
}

export async function selectBook() {
  return bk.worker.selectBook();
}
