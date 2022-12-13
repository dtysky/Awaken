/**
 * @File   : utils.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:18:24
 */
import bk from '../backend';
import {ISystemSettings} from '../interfaces';
import {IBook} from '../interfaces/protocols';

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

export async function selectNote() {
  return bk.worker.selectNote();
}

export async function searchFirstInBook(
  text: string, book: ePub.Book,
  title: string, fromSection: number
): Promise<{cfi: string, section?: number}> {
  const spineItems = (book.spine as any).spineItems as any[];
  const len = spineItems.length;
  let section: any;
  let i: number;

  for (i = fromSection; i < len; i += 1) {
    section = spineItems[i];
    await section.load(book.load.bind(book));
    const t = section.document.getElementsByTagName('h2')[0]?.textContent?.replace(/\[\d+?\]/g, '');

    if (t === title) {
      break;
    }

    section = undefined;
  }

  if (!section) {
    return undefined;
  }

  const res = findFromSection(section, text)[0];
  if (res) {
    res.section = i;
    return res;
  }

  return undefined;
}

// 这是一个无奈的hack...
// 用`query`的前N个字获取`cfiStart`，后N个字获取`cfiEnd`，最后merge
// N看实际情况来取，而`end`需要在`start`的十六段之内
function findFromSection(section: any, _query: string): {cfi: string, section?: number}[] {
  const matches: {cfi: string, excerpt: string}[] = [];
  const query = _query.toLowerCase();
  const find = function(node: HTMLElement){
    const text = node.textContent.toLowerCase();
    let range = section.document.createRange();
    let cfi: string;
    let pos: number;
    let last: number = -1;
    let excerpt: string;
    let limit: number = 150;

    while (pos != -1) {
      pos = text.indexOf(query, last + 1);

      if (pos != -1) {
        // 还得再想想，这块，有footprint link的地方，怎么处理
        console.log(node, node.childNodes, pos)
        range = section.document.createRange();
        range.setStart(node, pos);
        range.setEnd(node, pos + query.length);

        cfi = section.cfiFromRange(range);

        // Generate the excerpt
        if (node.textContent.length < limit) {
          excerpt = node.textContent;
        } else {
          excerpt = node.textContent.substring(pos - limit/2, pos + limit/2);
          excerpt = "..." + excerpt + "...";
        }

        // Add the CFI to the matches list
        matches.push({
          cfi: cfi,
          excerpt: excerpt
        });
      }

      last = pos;
    }
  };

  const elements = (section.document as Document).getElementsByTagName('p');
  const len = elements.length;
  for (let i = 0; i < len; i += 1) {
    find(elements[i]);
  }

  return matches;
}
