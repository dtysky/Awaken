/**
 * @File   : Viewer.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/20 23:29:09
 */
import * as React from 'react';
import ePub from 'epubjs';

import {mergeCFI, IBookIndex} from './common';
import {Tools} from './Tools';
import {protectBookDocument, protectBookNavigation} from './contentSecurity';
import {IBookNote} from '../../interfaces/protocols';
import css from '../styles/reader.module.scss';

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
  onBookmarkInfo(info: IBookNote, withProgress: boolean): void;
  onChangeNotes(notes: IBookNote[]): void;
  onError(error: Error): void;
}

type TState = 'Init' | 'Loading' | 'Ready';

let rendition: ePub.Rendition;
let withProgress: boolean = false;
let idToHref: {[id: string]: string};
function convertEPUBIndex(toc: ePub.NavItem, res: IBookIndex[]) {
  const sub: IBookIndex[] = [];
  res.push({id: toc.id, label: toc.label, children: sub});
  idToHref[toc.id] = toc.href;
  
  toc.subitems?.forEach(t => convertEPUBIndex(t, sub));
}

export function Viewer(props: IViewerProps) {
  const latestProps = React.useRef(props);
  latestProps.current = props;
  const bookRef = React.useRef<ePub.Book>();
  React.useEffect(() => () => { bookRef.current?.destroy(); }, []);
  const [state, setState] = React.useState<TState>('Init');
  const [content, setContent] = React.useState<ePub.Contents>();
  const [noteCFI, setNoteCFI] = React.useState<string>('');
  const [style, setStyle] = React.useState<string>();

  function updateProgress(location) {
    const loc = rendition.book.locations.locationFromCfi(location.start.cfi) as unknown as number;
    latestProps.current.onBookmarkInfo({
      start: location.start.cfi,
      end: location.end.cfi,
      cfi: mergeCFI(location.start.cfi, location.end.cfi),
      page: loc, modified: Date.now()
    }, withProgress);
  }

  React.useEffect(() => {
    if (state === 'Init') {
      setState('Loading');
      const book = ePub(props.content);
      bookRef.current = book;
      book.spine.hooks.content.register(protectBookDocument);
      rendition = book.renderTo('epub-viewer', {
        width: '100%',
        height: '100%',
        stylesheet: props.bookStyle,
        // Book scripts are blocked by the CSP injected before serialization.
        // WebKit needs this sandbox flag for the reader's own DOM callbacks.
        allowScriptedContent: true,
        allowPopups: false
      } as any);
      rendition.hooks.content.register(protectBookNavigation);
      setStyle(props.bookStyle);

      book.loaded.navigation.then(nav => {
        const promise: Promise<string[]> = props.pages ?
          new Promise(resolve => resolve(book.locations.load(props.pages))) :
          book.locations.generate(600);

        return promise.then(pages => {
          idToHref = {};
          const indexes: IBookIndex[] = [];
          nav.toc.forEach(t => {
            convertEPUBIndex(t, indexes);
          });
          rendition.on('relocated', updateProgress);

          const jump = (action: EJumpAction, cfiOrPageOrIndex?: string | number | IBookIndex) => {
            withProgress = action !== EJumpAction.Page;

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
            notes.filter(note => !note.removed).forEach(note => rendition.annotations.add('highlight', note.cfi, undefined, undefined, 'awaken-highlight'));
          };

          syncNotes([], props.notes);

          return rendition.display(rendition.book.locations.cfiFromLocation(0)).then(() => {
            setState('Ready');
            return Promise.resolve(props.onLoad(indexes, pages, jump, syncNotes));
          });
        });
      }).catch(props.onError);

      const selecting = new WeakSet<ePub.Contents>();
      const selectNote = (cfiRange: string, selectedContent: ePub.Contents) => {
        if (!selectedContent || selecting.has(selectedContent)) { return; }
        setContent(selectedContent);
        setNoteCFI(cfiRange);
      };
      const beginSelection = (_event: Event, selectedContent: ePub.Contents) => {
        selecting.add(selectedContent);
      };
      const endSelection = (_event: Event, selectedContent: ePub.Contents) => {
        selecting.delete(selectedContent);
        const selection = selectedContent.window.getSelection();
        if (selection?.rangeCount && !selection.isCollapsed) {
          selectNote(selectedContent.cfiFromRange(selection.getRangeAt(0)), selectedContent);
        }
      };

      // epub.js forwards each chapter's selection with its own Contents. Its
      // debounced selected event also handles WebKit selectionchange arriving
      // after mouseup, and selections made with the keyboard.
      rendition.on('selected', selectNote);
      rendition.on('mousedown', beginSelection);
      rendition.on('touchstart', beginSelection);
      rendition.on('mouseup', endSelection);
      rendition.on('touchend', endSelection);
      rendition.on('markClicked', (cfi: string, _data: any, selectedContent: ePub.Contents) => selectNote(cfi, selectedContent));

      rendition.on('rendered', (_section, view) => {
        const c = view.contents;
        if (process.env.isProd) {
          c.document.body.oncontextmenu = () => false
        }
      });
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
        onChangeNotes={props.onChangeNotes}
        onClose={() => setNoteCFI('')}
        onError={props.onError}
      />
    </>
  )
}

