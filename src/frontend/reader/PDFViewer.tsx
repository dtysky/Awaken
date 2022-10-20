/**
 * @File   : PDFViewer.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/20 23:29:17
 */
import * as React from 'react';

import css from '../styles/reader.module.scss';
import {IBookIndex, IViewerCommonProps} from './types';

type TState = 'Init' | 'Loading' | 'Ready';

export function PDFViewer(props: IViewerCommonProps) {
  const [state, setState] = React.useState<TState>('Init');
  const [progress, setProgress] = React.useState<number>(1);

  React.useEffect(() => {
    if (state === 'Init') {
      setState('Loading');
      setState('Ready');
    }
  });

  return (
    <div id='pdf-viewer' className={css.viewer} />
  )
}
