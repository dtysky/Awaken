/**
 * @File   : Viewer.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:09:11
 */
import * as React from 'react';
import ePub from 'epubjs';

import css from '../styles/reader.module.less';
import { TBookType } from '../../interfaces/protocols';

interface IViewerCommonProps {
  content: ArrayBuffer;
}

export interface IViewerProps extends IViewerCommonProps {
  type: TBookType;
}

export function Viewer(props: IViewerProps) {
  if (props.type === 'EPUB') {
    return <EPUBViewer content={props.content} />
  }

  return null;
}

type TState = 'Init' | 'Loading' | 'Ready';


function EPUBViewer(props: IViewerCommonProps) {
  const [state, setState] = React.useState<TState>('Init');

  React.useEffect(() => {
    if (state === 'Init') {
      setState('Loading');
      console.log(props.content)
      const book = ePub(props.content);
      console.log(book);
      const rendition = book.renderTo('epub-viewer', {
        width: window.innerWidth - 40,
        height: window.innerHeight - 40,
        method: 'default'
      } as any);
      console.log(rendition);
      rendition.display().then(() => {
        console.log('ready', book)
        setState('Ready');
        rendition.next();
      });
    }
  });

  return (
    <div id='epub-viewer' className={css.viewer}>

    </div>
  )
}

