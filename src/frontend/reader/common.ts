/**
 * @File   : common.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/29 15:38:52
 */
import {EpubCFI} from 'epubjs';
import {IBookNote} from '../../interfaces/protocols';

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

const parser = new EpubCFI() as any;

export function mergeCFI(cfi1: string, cfi2: string): string {
  let tmp = parser.getPathComponent(cfi1);
  const tmp1: string[] = tmp.substring(0, tmp.length - 1).split('/').slice(2);
  tmp = parser.getPathComponent(cfi2);
  const tmp2: string[] = tmp.substring(0, tmp.length - 1).split('/').slice(2);

  const base: string[] = [];
  let i: number = 0;
  for (i = 0; i < tmp1.length; i =+ 1) {
    if (tmp1[i] !== tmp2[i]) {
      break;
    }

    base.push(tmp1[i]);
  }

  const r1 = tmp1.slice(i);
  const r2 = tmp2.slice(i);

  return `epubcfi(/6/4!/4/${base.join('/')},/${r1.join('/')},/${r2.join('/')})`;
}

export interface INoteMarkStatus {
  exist: boolean;
  index: number;
}

export function checkNoteMark(bookmarks: IBookNote[], cfi: string): INoteMarkStatus {
  if (!bookmarks.length) {
    return {exist: false, index: 0};
  }

  console.log('xxxx', bookmarks)
  for (let index = 0; index < bookmarks.length; index += 1) {
    const res = parser.compare(cfi, bookmarks[index].cfi);
    console.log(res);

    // if (res >= 0) {
    //   return {exist: true, index};
    // }
  }

  return {exist: false, index: bookmarks.length};
}

export function changeBookmark(
  bookmarks: IBookNote[],
  note: IBookNote,
  status: INoteMarkStatus,
  action?: ENoteAction,
): INoteMarkStatus {
  action = action || (status.exist ? ENoteAction.Delete : ENoteAction.Add);

  if (action === ENoteAction.Add) {
    bookmarks.splice(status.index, 0, note);
    status.exist = true;
  } else if (action === ENoteAction.Delete) {
    bookmarks.splice(status.index, 1);
    status.exist = false;
  }

  return Object.assign({}, status);
}

// export function decodeCfi(cfi: string, isBookmark: boolean): IBookNote {
//   const range: string[] = parser.getRange(cfi);
//   const paths: string[] = parser.getPathComponent(cfi).split('/').slice(2);
//   const pathsLen = paths.length;
//   const note: IBookNote = {
//     isBookmark,
//     chapters: [],
//     steps: [],
//     start: [],
//     end: range ? [] : undefined,
//     annotation: ''
//   }

//   if (!range) {
//     // epubcfi(/6/6!/4/2[二]/2/1:0)
//     paths.forEach((p, index) => {
//       if (index < pathsLen - 2) {
//         const [c, s] = p.split('[');
//         note.chapters.push(s.substring(0, s.length - 1));
//         note.steps.push(parseInt(c, 10));
//       } else if (index === pathsLen - 2) {
//         note.start.push(parseInt(p, 10));
//       } else {
//         note.start.push(parseInt(p.split(':')[1], 10));
//       }
//     });

//     return note;
//   }

//   const rS = range[0].split('/').slice(1);
//   const rE = range[1].split('/').slice(1);
//   const sameSE = rS.length === 1;
//   const chapterEdge = sameSE ? pathsLen - 1 : pathsLen;
  
//   paths.forEach((p, index) => {
//     if (index < chapterEdge) {
//       const [c, s] = p.split('[');
//       note.chapters.push(s.substring(0, s.length - 1));
//       note.steps.push(parseInt(c, 10));
//     } else {
//       // epubcfi(/6/4!/4/2[我为什么写作]/6[一]/30,/1:106,/1:154)
//       const loc = parseInt(p, 10);
//       note.start.push(loc);
//       note.end.push(loc);
//     }
//   });

//   if (!sameSE) {
//     // epubcfi(/6/4!/4/2[我为什么写作]/6[一],/30/1:187,/32/1:14)
//     note.start.push(parseInt(rS[0], 10));
//     note.end.push(parseInt(rE[0], 10));
//   }

//   note.start.push(parseInt(rS.pop().split(':')[1], 10));
//   note.end.push(parseInt(rE.pop().split(':')[1], 10));

//   return note;
// }

// export function encodeCfi(note: IBookNote): string {
//   const {chapters, steps, start, end} = note;
//   let res = '';

//   chapters.forEach((c, i) => {
//     res += `/${steps[i]}[${c}]`;
//   });

//   if (!end) {
//     res += `/${start[0]}/1:${start[1]}`;
//   } else {
//     res += `,/${start[0]}/1:${start[1]}`;
//     res += `,/${end[0]}/1:${end[1]}`;
//   }

//   return `epubcfi(/6/6!/4${res})`;
// }
