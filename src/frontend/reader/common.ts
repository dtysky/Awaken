/**
 * @File   : common.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/29 15:38:52
 */
import {EpubCFI} from 'epubjs';
import {IBookNote} from '../../interfaces/protocols';

const parser = new EpubCFI() as any;

export interface IBookNoteParsed extends IBookNote {
  // cfi
  start: string;
  end: string;
}

export function convertBookNotes(notes: IBookNote[]): IBookNoteParsed[] {
  notes.forEach(note => {
    const cfi = note;
    const base = parser.getPathComponent(cfi);
    const [r1, r2] = parser.getRange(cfi);

    const n = note as IBookNoteParsed;
    n.start = `epubcfi(/6/4!/4/${base}${r1})`;
    n.end = `epubcfi(/6/4!/4/${base}${r2})`;
  });

  return notes as IBookNoteParsed[];
}

export interface IBookIndex {
  id: string | number;
  label: string;
  children: IBookIndex[];
}

export enum ENoteAction {
  Add,
  Update,
  Delete
}

export function mergeCFI(cfi1: string, cfi2: string): string {
  let tmp = parser.getPathComponent(cfi1);
  const tmp1: string[] = tmp.substring(0, tmp.length - 1).split('/').slice(2);
  tmp = parser.getPathComponent(cfi2);
  const tmp2: string[] = tmp.substring(0, tmp.length - 1).split('/').slice(2);

  const base: string[] = [];
  let i: number = 0;
  for (i = 0; i < tmp1.length; i += 1) {
    if (tmp1[i] !== tmp2[i]) {
      break;
    }

    base.push(tmp1[i]);
  }

  const r1 = tmp1.slice(i);
  const r2 = tmp2.slice(i);

  return `epubcfi(/6/4!/4/${base.join('/')},/${r1.join('/')},/${r2.join('/')})`;
}

export function splitCFI(cfi: string) {
  const chapter = parser.getChapterComponent(cfi);
  const base = parser.getPathComponent(cfi);
  const [s, e] = parser.getRange(cfi);
  
  return [`${chapter}!${base}${s})`, `${chapter}!${base}${e}`];
}

export interface INoteMarkStatus {
  exist: boolean;
  index: number;
}

export function checkNoteMark(notes: IBookNoteParsed[], start: string, end: string): INoteMarkStatus {
  if (!notes.length) {
    return {exist: false, index: 0};
  }

  for (let index = 0; index < notes.length; index += 1) {
    const {start: s, end: e} = notes[index];
    const cse = parser.compare(start, e);
    const ces = parser.compare(end, s);

    if (ces <= 0) {
      return {exist: false, index};
    }

    if (cse <= 0) {
      return {exist: true, index};
    }
  }

  return {exist: false, index: notes.length};
}

export function changeNote(
  notes: IBookNoteParsed[],
  note: IBookNoteParsed,
  status: INoteMarkStatus,
  action?: ENoteAction,
): INoteMarkStatus {
  action = action || (status.exist ? ENoteAction.Delete : ENoteAction.Add);

  if (action === ENoteAction.Add) {
    notes.splice(status.index, 0, note);
    status.exist = true;
  } else if (action === ENoteAction.Delete) {
    notes.splice(status.index, 1);
    status.exist = false;
  }

  return Object.assign({}, status);
}
