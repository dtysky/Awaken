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

  return settings;
}

export async function saveSettings(settings: ISystemSettings) {
  return bk.worker.saveSettings(settings);
}

export async function loadBooks() {
  let books: IBook[] = [];
  if (await bk.worker.fs.exists('books.json', 'Books')) {
    const txt = await bk.worker.fs.readFile('books.json', 'utf8', 'Books') as string;
    books = JSON.parse(txt);
    if (!Array.isArray(books)) {
      throw new Error('本地书目索引格式错误，请保留文件以便恢复。');
    }
  } else {
    await bk.worker.fs.writeFile('books.json', '[]', 'Books');
  }

  for (const book of books) {
    await fillBookCover(book);
  }

  return books;
}

export async function fillBookCover(book: IBook) {
  book.cover = await bk.worker.fs.exists(`${book.hash}/cover.png`, 'Books') ? bk.worker.getCoverUrl(book) : undefined;
}

export async function selectFolder(requireRes: boolean): Promise<string> {
  const folder = await bk.worker.selectFolder();

  if (!folder && !requireRes) {
    return folder;
  }

  if (!folder && requireRes) {
    return selectFolder(requireRes);
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
  fromSection: number = 0, firstNode?: Node,
  hint?: {cfi?: string}
): Promise<{cfi: string, endNode: Node, section?: number}> {
  const query = normalizeNoteText(text);
  const items = (book.spine as any).spineItems as any[];
  const missing = {cfi: '', section: fromSection, endNode: firstNode};
  if (!query || !items.length) { return missing; }

  // A prepared file can identify one occurrence of a repeated quotation.
  // Never trust that location without checking its complete selected text.
  if (hint?.cfi) {
    try {
      const range = await book.getRange(hint.cfi);
      const section = book.spine.get(hint.cfi) as any;
      if (range && section && normalizeNoteText(range.toString()) === query) {
        const index = indexNoteText(section.document);
        const entry = index.nodes.find(item => item.node === range.startContainer);
        const offset = entry?.offsets.findIndex(value => value >= range.startOffset);
        const start = entry && offset >= 0 ? entry.start + offset : 0;
        noteSearchCursor.set(book, {section: section.index, start, endNode: range.endContainer});
        return {cfi: hint.cfi, section: section.index, endNode: range.endContainer};
      }
    } catch { /* Invalid or stale hints fall back to exact text search. */ }
  }

  const begin = Math.max(0, Math.min(fromSection || 0, items.length - 1));
  const previous = firstNode && noteSearchCursor.get(book);
  const continued = previous && previous.section === begin && previous.endNode === firstNode;
  let firstOffset = continued ? previous.start : 0;
  const find = async (sectionIndex: number, lower: number, upper = Infinity) => {
    const section = items[sectionIndex];
    await section.load(book.load.bind(book));
    const index = indexNoteText(section.document);
    if (sectionIndex === begin && firstNode && !continued && !lower && upper === Infinity) {
      const entry = index.nodes.find(item => item.node === firstNode || firstNode.contains?.(item.node));
      firstOffset = entry?.start || 0;
      lower = firstOffset;
    }
    const start = index.text.indexOf(query, lower);
    if (start < 0 || start >= upper) { return undefined; }
    const end = start + query.length - 1;
    const a = index.nodes.find(item => item.start <= start && start < item.end);
    const b = index.nodes.find(item => item.start <= end && end < item.end);
    if (!a || !b) { return undefined; }
    const range = section.document.createRange() as Range;
    range.setStart(a.node, a.offsets[start - a.start]);
    range.setEnd(b.node, b.offsets[end - b.start] + 1);
    // Check the mapped DOM range too: whitespace removal must not shift offsets.
    if (normalizeNoteText(range.toString()) !== query) { return undefined; }
    noteSearchCursor.set(book, {section: sectionIndex, start, endNode: b.node});
    return {cfi: section.cfiFromRange(range), section: sectionIndex, endNode: b.node};
  };

  // Keep the prior start (not its end), so overlapping highlights remain valid.
  for (let i = begin; i < items.length; i += 1) {
    const result = await find(i, i === begin ? firstOffset : 0);
    if (result) { return result; }
  }
  // Export order can differ from reading order; retry the earlier part once.
  for (let i = 0; i <= begin; i += 1) {
    if (i === begin && !firstOffset) { break; }
    const result = await find(i, 0, i === begin ? firstOffset : Infinity);
    if (result) { return result; }
  }
  return missing;
}

interface NoteTextNode {
  node: Text;
  start: number;
  end: number;
  offsets: number[];
}
interface NoteTextIndex {text: string; nodes: NoteTextNode[]; root: Node;}
const noteTextIndexes = new WeakMap<Document, NoteTextIndex>();
const noteSearchCursor = new WeakMap<ePub.Book, {section: number; start: number; endNode: Node}>();

function normalizeNoteText(text: string): string {
  return text.replace(/\s+/g, '');
}

function indexNoteText(document: Document): NoteTextIndex {
  const root = document.body || document.querySelector('body') || document.documentElement;
  const cached = noteTextIndexes.get(document);
  if (cached && cached.root === root) { return cached; }
  const nodes: NoteTextNode[] = [];
  const chunks: string[] = [];
  let length = 0;
  const pending: Node[] = root ? [root] : [];
  while (pending.length) {
    const node = pending.pop();
    if (node.nodeType === 1 && /^(script|style|noscript)$/i.test((node as Element).tagName)) { continue; }
    if (node.nodeType === 3) {
      const raw = node.textContent || '', offsets: number[] = [], characters: string[] = [];
      // DOM Range offsets are UTF-16 code units, including surrogate pairs.
      for (let i = 0; i < raw.length; i += 1) {
        if (!/\s/.test(raw[i])) { offsets.push(i); characters.push(raw[i]); }
      }
      if (offsets.length) {
        nodes.push({node: node as Text, start: length, end: length + offsets.length, offsets});
        chunks.push(characters.join(''));
        length += offsets.length;
      }
    } else {
      for (let i = node.childNodes.length - 1; i >= 0; i -= 1) { pending.push(node.childNodes[i]); }
    }
  }
  const index = {text: chunks.join(''), nodes, root};
  noteTextIndexes.set(document, index);
  return index;
}
