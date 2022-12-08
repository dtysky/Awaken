/**
 * @File   : common.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/29 15:38:52
 */
import {useRef, useEffect} from 'react';
import {EpubCFI} from 'epubjs';
import {IReadSettings, ISystemSettings} from '../../interfaces';
import {IBookNote} from '../../interfaces/protocols';

export function usePrevious<T>(value: T) {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

const parser = new EpubCFI() as any;

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

export function checkNoteMark(notes: IBookNote[], start: string, end: string): INoteMarkStatus {
  if (!notes.length) {
    return {exist: false, index: 0};
  }

  for (let index = 0; index < notes.length; index += 1) {
    const {start: s, end: e, removed} = notes[index];
    const cse = parser.compare(start, e);
    const ces = parser.compare(end, s);

    if (ces <= 0) {
      return {exist: false, index};
    }

    if (cse <= 0) {
      return {exist: removed ? false : true, index};
    }
  }

  return {exist: false, index: notes.length};
}

export function changeNote(
  notes: IBookNote[],
  note: IBookNote,
  status: INoteMarkStatus,
  action?: ENoteAction,
): INoteMarkStatus {
  action = action || (status.exist ? ENoteAction.Delete : ENoteAction.Add);

  if (action === ENoteAction.Add) {
    if (status.index !== notes.length) {
      notes.splice(status.index, 1, note);
    } else {
      notes.splice(status.index, 0, note);
    }
    status.exist = true;
  } else if (action === ENoteAction.Delete) {
    note.removed = Date.now();
    status.exist = false;
  } else {
    note.modified = Date.now();
  }

  return Object.assign({}, status);
}

let preHash: string = '';
let preStyle: string;
export function buildStyleUrl(settings: IReadSettings): string {
  const hash = Object.keys(settings).map(key => settings[key]).join('|');

  if (hash === preHash) {
    return preStyle;
  }

  const style = `
body {
  color: ${settings.color};
  font-size: ${settings.fontSize}rem;
  line-height: ${settings.fontSize + settings.lineSpace}rem;
  touch-action: none;
  -webkit-touch-callout: none;
}

img {
  width: 100%;
}

a {
  color: ${settings.color};
  text-decoration: none;
  border-bottom: 2px solid ${settings.highlight};
}
  `

  URL.revokeObjectURL(preStyle);
  preHash = hash;
  preStyle = URL.createObjectURL(new Blob([style], {type: 'text/css'}));

  return preStyle;
}
