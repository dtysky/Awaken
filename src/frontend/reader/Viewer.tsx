/**
 * @File   : Viewer.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/20 23:29:09
 */
import * as React from 'react';
import ePub from 'epubjs';

import css from '../styles/reader.module.scss';
import {mergeCFI, IBookIndex} from './common';
import {Tools} from './Tools';
import { IBookNote } from '../../interfaces/protocols';

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
  onBookmarkInfo(info: IBookNote): void;
  onProgress(progress: number): void;
  onChangeNotes(notes: IBookNote[]): void;
}

type TState = 'Init' | 'Loading' | 'Ready';

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
  const [content, setContent] = React.useState<ePub.Contents>();
  const [noteCFI, setNoteCFI] = React.useState<string>('');

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

          props.notes.forEach(note => {
            rendition.annotations.add('highlight', note.cfi);
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
              // first, jump to chapter
              rendition.display(cfiOrPageOrIndex as string).then(() => {
                // then, jump to note
                rendition.display(cfiOrPageOrIndex as string);
              })
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

      const addNote = async (cfiRange: string) => {
        setNoteCFI(cfiRange);
      }

      rendition.on('rendered', () => {
        content?.off('selected', addNote);
        const c = rendition.getContents()[0];
        c?.on('selected', addNote);
        setContent(c);
      });
    }
  });

  return (
    <>
      <div id='epub-viewer' className={css.viewer} />
      <Tools
        notes={props.notes}
        rendition={rendition}
        content={content}
        cfi={noteCFI}
        onChangeNotes={notes => {
          setNoteCFI('');
          props.onChangeNotes(notes);
        }}
      />
    </>
  )
}

