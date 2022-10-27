/**
 * @File   : EPUBViewer.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/20 23:29:09
 */
import * as React from 'react';
import ePub from 'epubjs';

import css from '../styles/reader.module.scss';
import {IBookIndex, IViewerCommonProps} from './types';

type TState = 'Init' | 'Loading' | 'Ready';

let preIndex: IBookIndex;
let rendition: ePub.Rendition;
let idToHref: {[id: string]: string};
function convertEPUBIndex(toc: ePub.NavItem, res: IBookIndex[]) {
  const sub: IBookIndex[] = [];
  res.push({id: toc.id, label: toc.label, children: sub});
  idToHref[toc.id] = toc.href;
  
  toc.subitems?.forEach(t => convertEPUBIndex(t, sub));
}

export function EPUBViewer(props: IViewerCommonProps) {
  const [state, setState] = React.useState<TState>('Init');
  const [progress, setProgress] = React.useState<number>(1);

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
          props.onLoad(indexes, 1, cfis.length);
          
          setState('Ready');
        });
      });

      rendition.on('rendered', e => {
        rendition.getContents()[0].on('selected', (cfiRange) => {
          console.log('r c', cfiRange);
        })
      });
    }


    function updateProgress(location) {
      const loc = rendition.book.locations.locationFromCfi(location.start.cfi) as unknown as number;
      setProgress(loc);
      props.onProgress(loc);
      rendition.off('relocated', updateProgress);
    }

    if (preIndex !== props.index) {
      preIndex = props.index;
      rendition.on('relocated', updateProgress);
      rendition?.display(idToHref[preIndex.id]);
    }

    if (props.progress !== progress) {
      setProgress(props.progress);
      rendition.display(rendition.book.locations.cfiFromLocation(props.progress));
    }
  });

  return (
    <div id='epub-viewer' className={css.viewer} />
  )
}

