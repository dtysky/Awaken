/**
 * @File   : Viewer.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/20 23:29:09
 */
import * as React from 'react';
import ePub, {Contents} from 'epubjs';

import bk from '../../backend';
import {mergeCFI, IBookIndex, usePrevious} from './common';
import {Tools} from './Tools';
import {IBookNote} from '../../interfaces/protocols';
import css from '../styles/reader.module.scss';

const EVENT_NAME = bk.supportChangeFolder ? 'mouseup' : 'touchend';
(Contents as any).prototype.onSelectionChange = function(e: Event) {
  const t = this as any;

  if (t.doingSelection) {
    return;
  }

  const handler = function() {
    t.window.removeEventListener(EVENT_NAME, handler);
    const selection = t.window.getSelection();
    t.triggerSelectedEvent(selection);
    t.doingSelection = false;
  };

  t.window.addEventListener(EVENT_NAME, handler);
  t.doingSelection = true;
}

export enum EJumpAction {
  CFI,
  Page,
  Index,
  Next,
  Pre
}

export interface IViewerProps {
  content: ArrayBuffer;
  bookStyle: string;
  pages?: string;
  bookmarks: IBookNote[];
  notes: IBookNote[];
  onLoad(
    indexes: IBookIndex[], pages: string[],
    jump: (action: EJumpAction, cfiOrPageOrIndex?: string | number | IBookIndex) => void,
    syncNotes: (preNotes: IBookNote[], notes: IBookNote[]) => void
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
  const [style, setStyle] = React.useState<string>();

  function updateProgress(location) {
    const loc = rendition.book.locations.locationFromCfi(location.start.cfi) as unknown as number;
    rendition.off('relocated', updateProgress);
    props.onProgress(loc);
    props.onBookmarkInfo({
      start: location.start.cfi,
      end: location.end.cfi,
      cfi: mergeCFI(location.start.cfi, location.end.cfi),
      page: loc, modified: Date.now()
    });
  }

  React.useEffect(() => {
    if (state === 'Init') {
      setState('Loading');
      const book = ePub(props.content);
      rendition = book.renderTo('epub-viewer', {
        width: '100%',
        height: '100%',
        stylesheet: props.bookStyle,
        allowScriptedContent: true,
        allowPopups: true
      } as any);
      setStyle(props.bookStyle);

      book.loaded.navigation.then(nav => {
        const promise: Promise<string[]> = props.pages ?
          new Promise(resolve => resolve(book.locations.load(props.pages))) :
          book.locations.generate(600);

        promise.then(pages => {
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
              // first, jump to chapter
              rendition.display(cfiOrPageOrIndex as string).then(() => {
                // then, jump to note
                rendition.display(cfiOrPageOrIndex as string);
              });
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

          const syncNotes = (preNotes: IBookNote[], notes: IBookNote[]) => {
            if (!rendition.annotations) {
              return;
            }

            preNotes.forEach(note => rendition.annotations.remove(note.cfi, 'highlight'));
            notes.forEach(note => rendition.annotations.add('highlight', note.cfi, undefined, undefined, 'awaken-highlight'));
          };

          syncNotes([], props.notes);

          rendition.display(rendition.book.locations.cfiFromLocation(0)).then(() => {
            props.onLoad(indexes, pages, jump, syncNotes);
            setState('Ready');
          });
        });
      });

      const selectNote = (cfiRange: string) => {
        setNoteCFI(cfiRange);
      }

      rendition.on('rendered', () => {
        const c = rendition.getContents()[0];
        c !== content && setContent(c);
        if (process.env.isProd) {
          c.document.body.oncontextmenu = () => false
        }
      });

      rendition.on('locationChanged', () => {
        content?.off('selected', selectNote);
        const c = rendition.getContents()[0];
        c?.on('selected', selectNote);
        c !== content && setContent(c);
      });

      rendition.on('markClicked', selectNote);
    } else if (state === 'Ready') {
      if (style !== props.bookStyle) {
        rendition.themes.register('awaken-style', props.bookStyle);
        rendition.themes.select('awaken-style');
        setStyle(props.bookStyle);
      }
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

