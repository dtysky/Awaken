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

  const cfi = findFromSection(section, text);
  console.log(cfi)
  return cfi ? {cfi, section: i} : undefined;
}

/**
 * 这是一个无奈的hack...
 * 用`query`的前N个字获取`cfiStart`，后N个字获取`cfiEnd`，最后merge
 * N看实际情况来取，而`textE`需要在`textS`（无link）/`linkE`（有link）的十六个结点之内
 * 
 * 先判断是否有[\d+]的link，没有的话
 *  小于八个字的，直接全文搜索
 *  大于八个字的，拆成前八后八两部分，分别搜索后合并
 * 有的话
 *  先查找到第一个link，然后反向搜索link前的文本的前（小于等于八个字），没有文本则直接以link为起点
 *  然后找到最后一个link，正向搜索link后的文本的最后（小于等于八个字），没有文本则以link为终点
 */
function findFromSection(section: any, query: string): string {
  const texts = query.split(/\[\d+?\]/g);
  const links = [...query.matchAll(/(\[\d+?\])/g)].map(v => v[1]);
  let textS: string;
  let textE: string;
  let linkS: string;
  let linkE: string;

  if (!links.length) {
    const text = texts[0];
    if (text.length <= 8) {
      textS = text;
    } else {
      textS = text.slice(0, 8);
      textE = text.slice(text.length - 8, text.length);
    }
  } else {
    linkS = links[0];
    linkE = links.pop();
    textS = texts[0];
    textE = texts.pop();

    if (query.startsWith(linkS)) {
      textS = undefined;
    } else {
      textS = textS.slice(0, 8);
    }

    if (query.endsWith(linkE)) {
      textE = undefined;
    } else {
      textE = textE.slice(Math.max(textE.length - 8, 0), textE.length);
    }
  }

  const firstP = section.document.querySelector('p');
  if (!firstP) {
    return undefined;
  }

  let nodeS: Node, nodeE: Node;
  let posS: number, posE: number;
  // pos = text.indexOf(query, last + 1);

  if (!textE && !linkS && !linkE) {
    nodeS = walkFromNode(firstP, node => {
      posS = node.textContent.replace('\x20', '').indexOf(textS);
      return posS >= 0;
    });

    return nodeS ? getRange(section, nodeS, posS, nodeS, posS + textE.length) : undefined;
  }

  if (!linkS && !linkE) {
    nodeS = walkFromNode(firstP, node => {
      posS = node.textContent.replace('\x20', '').indexOf(textS);
      return posS >= 0;
    });

    if (!nodeS) {
      return undefined;
    }

    nodeE = walkFromNode(nodeS, node => {
      posE = node.textContent.replace('\x20', '').indexOf(textE);
      return posE >= 0;
    });

    return nodeE ? getRange(section, nodeS, posS, nodeE, posE + textE.length) : undefined;
  }

  nodeS = walkFromNode(firstP, node => {
    posS = node.textContent.indexOf(linkS);
    return posS >= 0;
  });

  if (!nodeS) {
    return undefined;
  }

  nodeE = linkS === linkE ? nodeS : walkFromNode(nodeS, node => {
    posE = node.textContent.indexOf(linkE);
    return posE >= 0;
  });

  if (!nodeE) {
    return undefined;
  }

  if (textS) {
    nodeS = walkFromNode(nodeS, node => {
      posS = node.textContent.replace('\x20', '').indexOf(textS);
      return posS >= 0;
    }, true);
  }

  if (!nodeS) {
    return undefined;
  }

  if (textE) {
    nodeE = walkFromNode(nodeE, node => {
      posE = node.textContent.replace('\x20', '').indexOf(textE);
      return posE >= 0;
    });
  }

  return nodeE ? getRange(section, nodeS, posS, nodeE, posE + (textE || linkE).length) : undefined;
}

function getRange(section: any, nodeS: Node, posS: number, nodeE: Node, posE: number) {
  const range = (section.document as Document).createRange();
  range.setStart(nodeS, posS);
  range.setEnd(nodeE, posE);

  return section.cfiFromRange(range);
}

function walkFromNode(node: Node, cb: (node: Node) => boolean, reverse: boolean = false): Node {
  if (node.childNodes.length) {
    if (reverse) {
      return walkFromNode(node.childNodes[node.childNodes.length - 1], cb);
    }

    return walkFromNode(node.childNodes[0], cb);
  }

  if (cb(node)) {
    return node;
  }

  while (node) {
    if (reverse) {
      if (node.previousSibling) {
        return walkFromNode(node.previousSibling, cb);
      }  
    } else {
      if (node.nextSibling) {
        return walkFromNode(node.nextSibling, cb);
      }
    }


    node = node.parentNode;
  }

  return undefined;
}
