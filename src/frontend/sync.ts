import {IBook, IBookConfig, IBookNote} from '../interfaces/protocols';
import {EpubCFI} from 'epubjs';

const parser = new EpubCFI();

export interface ISyncState {
  phase: 'local' | 'pending' | 'syncing' | 'synced' | 'error';
  lastSync?: number;
  bookCount?: number;
  allBooksPending?: boolean;
  error?: string;
  libraryPending: number;
  pendingBooks: {[hash: string]: number};
  remote?: string;
}

export function mergeBooks(local: IBook[], remote: IBook[]): IBook[] {
  const merged = new Map<string, IBook>();
  for (const book of [...local, ...remote]) {
    const previous = merged.get(book.hash);
    if (!previous) {
      merged.set(book.hash, {...book});
      continue;
    }
    const winner = book.ts > previous.ts || (book.ts === previous.ts && book.removed) ? book : previous;
    const bookshelf = (book.bookshelf?.ts || 0) > (previous.bookshelf?.ts || 0) ? book.bookshelf : previous.bookshelf;
    merged.set(book.hash, {...winner, bookshelf});
  }
  return [...merged.values()];
}

export function mergeNotes(local: IBookNote[], remote: IBookNote[], removedTs: {[cfi: string]: number}): IBookNote[] {
  const merged = new Map<string, IBookNote>();
  for (const note of [...local, ...remote]) {
    if (note.removed) {
      removedTs[note.cfi] = Math.max(removedTs[note.cfi] || 0, note.removed);
      continue;
    }
    const previous = merged.get(note.cfi);
    if (!previous || note.modified > previous.modified) {
      merged.set(note.cfi, {...note});
    }
  }
  return [...merged.values()]
    .filter(note => !removedTs[note.cfi] || note.modified > removedTs[note.cfi])
    .sort((a, b) => parser.compare(a.start, b.start) || parser.compare(a.end, b.end));
}

export function mergeConfig(local: IBookConfig, remote: IBookConfig): IBookConfig {
  const removedTs = {...local.removedTs};
  for (const [cfi, ts] of Object.entries(remote.removedTs || {})) {
    removedTs[cfi] = Math.max(removedTs[cfi] || 0, ts);
  }
  return {
    ...local,
    ts: Math.max(local.ts || 0, remote.ts || 0),
    lastProgress: (local.ts || 0) >= (remote.ts || 0) ?
      (local.lastProgress ?? local.progress) : (remote.lastProgress ?? remote.progress),
    notes: mergeNotes(local.notes || [], remote.notes || [], removedTs),
    bookmarks: mergeNotes(local.bookmarks || [], remote.bookmarks || [], removedTs),
    removedTs
  };
}

export function serializeBooks(books: IBook[]): string {
  return JSON.stringify(books.map(({cover, ...book}) => book));
}

export function validateBooks(value: unknown): IBook[] {
  if (!Array.isArray(value) || value.some(book =>
    !book || !/^[a-f0-9]{32}$/i.test(book.hash) ||
    typeof book.name !== 'string' || !book.name || /[\\/\u0000]/.test(book.name) ||
    !Number.isFinite(book.ts))) {
    throw new Error('书目索引格式错误，已停止同步以保护本地数据。');
  }
  return value;
}
