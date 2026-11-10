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
  const range = new EpubCFI(cfi1) as any;
  const end = new EpubCFI(cfi2) as any;
  if (range.spinePos !== end.spinePos) { return cfi1; }
  const startSteps = range.path.steps;
  const endSteps = end.path.steps;
  let common = 0;
  while (common < Math.min(startSteps.length, endSteps.length) - 1 &&
    JSON.stringify(startSteps[common]) === JSON.stringify(endSteps[common])) { common++; }
  range.range = true;
  range.start = {steps: startSteps.slice(common), terminal: range.path.terminal};
  range.end = {steps: endSteps.slice(common), terminal: end.path.terminal};
  range.path = {steps: startSteps.slice(0, common), terminal: {offset: null, assertion: null}};
  return range.toString();
}

export function splitCFI(cfi: string) {
  const start = new EpubCFI(cfi) as any;
  const end = new EpubCFI(cfi) as any;
  start.collapse(true);
  end.collapse(false);
  return [start.toString(), end.toString()];
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
  action = action ?? (status.exist ? ENoteAction.Delete : ENoteAction.Add);

  if (action === ENoteAction.Add) {
    if (notes[status.index]?.removed &&
      parser.compare(note.start, notes[status.index].end) <= 0 &&
      parser.compare(note.end, notes[status.index].start) > 0) {
      notes.splice(status.index, 1, note);
    } else {
      notes.splice(status.index, 0, note);
    }
    delete note.removed;
    status.exist = true;
  } else {
    if (status.exist) {
      notes[status.index] = note;
    }

    if (action === ENoteAction.Delete) {
      note.removed = Date.now();
      status.exist = false;
    } else {
      note.modified = Date.now();
    }
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
  letter-spacing: ${settings.letterSpace || 0}rem;
  touch-action: none;
  -webkit-touch-callout: none;
  word-break: break-all;
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
