/**
 * @File   : Viewer.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:09:11
 */
import * as React from 'react';
import ePub from 'epubjs';

import css from '../styles/reader.module.less';
import {TBookType} from '../../interfaces/protocols';
import {IBookIndex} from './types';

interface IViewerCommonProps {
  content: ArrayBuffer;
  onLoad(indexes: IBookIndex[], currentIndex: IBookIndex): void;
  index?: IBookIndex;
}

export interface IViewerProps extends IViewerCommonProps {
  type: TBookType;
}

export function Viewer(props: IViewerProps) {
  if (props.type === 'EPUB') {
    return (
      <EPUBViewer
        content={props.content}
        onLoad={props.onLoad}
        index={props.index}
      />
    );
  }

  return null;
}

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

function EPUBViewer(props: IViewerCommonProps) {
  const [state, setState] = React.useState<TState>('Init');

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
        console.log(nav)
        idToHref = {};
        const indexes: IBookIndex[] = [];
        nav.toc.forEach(t => {
          convertEPUBIndex(t, indexes);
        });
        props.onLoad(indexes, indexes[0]);
      })

      rendition.display().then(() => {
        setState('Ready');
      });
    }

    if (preIndex !== props.index) {
      preIndex = props.index;
      console.log(rendition, preIndex, idToHref[preIndex.id])
      rendition?.display(idToHref[preIndex.id]);
    }
  });

  return (
    <div id='epub-viewer' className={css.viewer}>

    </div>
  )
}

