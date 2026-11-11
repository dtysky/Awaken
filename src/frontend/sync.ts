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
    const remoteFile = winner.remoteFile || previous.remoteFile || book.remoteFile;
    const bookshelf = (book.bookshelf?.ts || 0) > (previous.bookshelf?.ts || 0) ? book.bookshelf : previous.bookshelf;
    merged.set(book.hash, {...winner, ...(remoteFile ? {remoteFile} : {}), bookshelf});
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

// Importing an export again must not erase comments edited in the reader.
// Preserve different comments together; subsequent imports remain idempotent.
export function mergeImportedNotes(local: IBookNote[], incoming: IBookNote[], removedTs: {[cfi: string]: number}): IBookNote[] {
  const existing = new Map(local.filter(note => !note.removed).map(note => [note.cfi, note]));
  const prepared = incoming.map(note => {
    const previous = existing.get(note.cfi);
    if (!previous) { existing.set(note.cfi, note); return note; }
    const oldComment = previous.annotation || '', newComment = note.annotation || '';
    const annotation = !newComment || oldComment.includes(newComment) ? oldComment :
      !oldComment ? newComment : `${oldComment}\n\n${newComment}`;
    if (annotation === oldComment) { return previous; }
    const merged = {...previous, annotation, modified: Math.max(note.modified, previous.modified + 1)};
    existing.set(note.cfi, merged);
    return merged;
  });
  return mergeNotes(local, prepared, removedTs);
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

// A repackaged EPUB has a different file hash even when it is the same book.
// Metadata matches are candidates for user review, not grounds for merging CFIs.
export function findMatchingBooks(books: IBook[], incoming: Pick<IBook, 'name' | 'author'>): IBook[] {
  const normalize = (value: string) => (value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const title = normalize(incoming.name), author = normalize(incoming.author);
  return title ? books.filter(book => !book.removed && normalize(book.name) === title && normalize(book.author) === author) : [];
}

export function safeRemoteEpubFile(name: string): string {
  const filename = `${name}.epub`;
  // Use a fixed basename inside the existing content-hash directory for titles
  // rejected by cross-platform WebDAV services such as Nutstore.
  const unsupported = /[\\/:*?"<>|\u0000-\u001f\u007f]/.test(name) || /^[#~]/.test(name) ||
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name) ||
    name.trim() !== name || /\.$/.test(name) || encodeURIComponent(filename).replace(/%[0-9a-f]{2}/gi, 'x').length > 180;
  return unsupported ? 'book.epub' : filename;
}

export function validateBooks(value: unknown): IBook[] {
  if (!Array.isArray(value) || value.some(book =>
    !book || !/^[a-f0-9]{32}$/i.test(book.hash) ||
    typeof book.name !== 'string' || !book.name || /[\\/\u0000]/.test(book.name) ||
    (book.remoteFile !== undefined && (typeof book.remoteFile !== 'string' ||
      /[\\/\u0000-\u001f]/.test(book.remoteFile) || !/^.+\.epub$/i.test(book.remoteFile))) ||
    !Number.isFinite(book.ts))) {
    throw new Error('书目索引格式错误，已停止同步以保护本地数据。');
  }
  return value;
}
