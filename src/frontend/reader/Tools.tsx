/**
 * @File   : Tools.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:09:30
 */
import * as React from 'react';
import {IconButton} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {IBookNote, TBookType} from '../../interfaces/protocols';
import {ENotesAction, IBookIndex} from './types';

interface IToolsProps {
  notes: IBookNote[];
  currentPos: number;
  requestMark: boolean;
  // when requestMark is true
  // if rangePos is undefined then switch bookmark
  // else show note pane
  requestStart?: string | number;
  requestLength?: number;
  onChangeNote(action: ENotesAction, note: IBookNote): void;
}

export function Notes(props: IToolsProps) {
  if (!props.notes?.length) {
    return null;
  }

  React.useEffect(() => {
    
  });

  return (
    <div className={css.tools}>
      <div className={css.toolsBookmark}>
        <IconButton
          type="leaf"
          color="grey"
          size="large"
          // onClick={() => props.onChangeNote(ENotesAction.Add)}
        />
      </div>
    </div>
  )
}
