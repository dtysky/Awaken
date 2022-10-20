/**
 * @File   : Viewer.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:09:11
 */
import * as React from 'react';

import css from '../styles/reader.module.scss';
import {TBookType} from '../../interfaces/protocols';
import {IViewerCommonProps} from './types';
import {EPUBViewer} from './EPUBViewer';
import { PDFViewer } from './PDFViewer';

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
        progress={props.progress}
        onProgress={props.onProgress}
      />
    );
  }

  if (props.type === 'PDF') {
    return (
      <PDFViewer
        content={props.content}
        onLoad={props.onLoad}
        index={props.index}
        progress={props.progress}
        onProgress={props.onProgress}
      />
    );
  }

  return null;
}
