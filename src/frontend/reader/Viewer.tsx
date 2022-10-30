/**
 * @File   : Viewer.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/20 23:29:09
 */
import * as React from 'react';
import ePub, { EpubCFI } from 'epubjs';

import css from '../styles/reader.module.scss';
import {mergeCFI, IBookIndex, IBookNoteParsed} from './common';
import {IBookNote} from '../../interfaces/protocols';


export enum EJumpAction {
  CFI,
  Page,
  Index,
  Next,
  Pre
}

export interface IViewerProps {
  content: ArrayBuffer;
  bookmarks: IBookNote[];
  notes: IBookNote[];
  onLoad(
    indexes: IBookIndex[], start: number, max: number,
    jump: (action: EJumpAction, cfiOrPageOrIndex?: string | number | IBookIndex) => void,
  ): void;
  onBookmarkInfo(info: IBookNoteParsed): void;
  onProgress?(progress: number): void;
  // onRequestNote(note: IBookNote): Promise<ENotesAction>;
}

type TState = 'Init' | 'Loading' | 'Ready';

let preContent: ePub.Contents;
let rendition: ePub.Rendition;
let idToHref: {[id: string]: string};
function convertEPUBIndex(toc: ePub.NavItem, res: IBookIndex[]) {
  const sub: IBookIndex[] = [];
  res.push({id: toc.id, label: toc.label, children: sub});
  idToHref[toc.id] = toc.href;
  
  toc.subitems?.forEach(t => convertEPUBIndex(t, sub));
}

export function Viewer(props: IViewerProps) {
  const [state, setState] = React.useState<TState>('Init');

  function updateProgress(location) {
    const loc = rendition.book.locations.locationFromCfi(location.start.cfi) as unknown as number;
    rendition.off('relocated', updateProgress);
    props.onProgress(loc);
    props.onBookmarkInfo({
      start: location.start.cfi,
      end: location.end.cfi,
      cfi: mergeCFI(location.start.cfi, location.end.cfi),
      page: loc
    });
  }

  React.useEffect(() => {
    if (state === 'Init') {
      setState('Loading');
      const book = ePub(props.content);
      rendition = book.renderTo('epub-viewer', {
        width: '100%',
        height: '100%',
        method: 'default'
      } as any);

      book.loaded.navigation.then(nav => {
        book.locations.generate(1000).then(cfis => {
          idToHref = {};
          const indexes: IBookIndex[] = [];
          nav.toc.forEach(t => {
            convertEPUBIndex(t, indexes);
          });

          const jump = (action: EJumpAction, cfiOrPageOrIndex?: string | number | IBookIndex) => {
            if (action !== EJumpAction.Page) {
              rendition.on('relocated', updateProgress);
            }

            if (action === EJumpAction.Pre) {
              rendition.prev();
              return;
            }

            if (action === EJumpAction.Next) {
              rendition.next();
              return;
            }

            if (action === EJumpAction.CFI) {
              rendition.display(cfiOrPageOrIndex as string);
              return;
            }

            if (action === EJumpAction.Index) {
              rendition.display(idToHref[(cfiOrPageOrIndex as IBookIndex).id]);  
              return;
            }

            if (action === EJumpAction.Page) {
              rendition.display(rendition.book.locations.cfiFromLocation(cfiOrPageOrIndex as number));
              return;
            }
          };

          props.onLoad(indexes, 1, cfis.length, jump);

          rendition.display(rendition.book.locations.cfiFromLocation(0));
          setState('Ready');
        });
      });

      const addNote = (cfiRange: string) => {
        console.log('r c', cfiRange);
        const x = new EpubCFI(cfiRange);
        console.log(x);
        rendition.annotations.add('highlight', cfiRange);
      }

      rendition.on('rendered', () => {
        preContent?.off('selected', addNote);
        preContent = rendition.getContents()[0];
        preContent?.on('selected', addNote);
      });
    }
  });

  return (
    <div id='epub-viewer' className={css.viewer} />
  )
}

