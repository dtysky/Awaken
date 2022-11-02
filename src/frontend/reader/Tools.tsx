/**
 * @File   : Tools.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:09:30
 */
import * as React from 'react';
import {IconButton} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {checkNoteMark, ENoteAction, IBookNoteParsed, splitCFI} from './common';

interface IToolsProps {
  notes: IBookNoteParsed[];
  cfi: string;
  onChangeNote(action: ENoteAction, note: IBookNoteParsed): void;
}

export function Tools(props: IToolsProps) {
  React.useEffect(() => {
    const [start, end] = splitCFI(props.cfi);
    const status = checkNoteMark(props.notes, start, end);

    console.log(status);
  });

  return (
    <div className={css.tools}>
      
    </div>
  )
}
