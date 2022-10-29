/**
 * @File   : Viewer.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/20 23:29:09
 */
import * as React from 'react';
import ePub, { EpubCFI } from 'epubjs';

import css from '../styles/reader.module.scss';
import {mergeCFI, IBookIndex} from './common';
import {IBookNote} from '../../interfaces/protocols';


export interface IViewerProps {
  content: ArrayBuffer;
  bookmarks: IBookNote[];
  notes: IBookNote[];
  index?: IBookIndex;
  progress: number;
  onLoad(indexes: IBookIndex[], start: number, max: number, jump: (cfi: string) => void): void;
  onBookmarkInfo(info: IBookNote): void;
  onProgress?(progress: number): void;
  // onRequestNote(note: IBookNote): Promise<ENotesAction>;
}

type TState = 'Init' | 'Loading' | 'Ready';

let preIndex: IBookIndex;
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
  const [progress, setProgress] = React.useState<number>(1);

  function updateProgress(location) {
    const loc = rendition.book.locations.locationFromCfi(location.start.cfi) as unknown as number;
    rendition.off('relocated', updateProgress);
    setProgress(loc);
    props.onProgress(loc);
    props.onBookmarkInfo({
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
        book.locations.generate(888).then(cfis => {
          idToHref = {};
          const indexes: IBookIndex[] = [];
          nav.toc.forEach(t => {
            convertEPUBIndex(t, indexes);
          });

          const jump = (cfi: string) => {
            rendition.on('relocated', updateProgress);
            rendition.display(cfi);
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

    if (preIndex !== props.index) {
      preIndex = props.index;
      rendition.on('relocated', updateProgress);
      rendition?.display(idToHref[preIndex.id]);
    }

    if (props.progress !== progress) {
      setProgress(props.progress);
      const cfi = rendition.book.locations.cfiFromLocation(props.progress);
      rendition.display(cfi).then(() => {
        props.onBookmarkInfo({
          cfi,
          page: rendition.book.locations.locationFromCfi(cfi) as unknown as number
        });
      });
    }
  });

  return (
    <div id='epub-viewer' className={css.viewer} />
  )
}

