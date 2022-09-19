/**
 * @File   : Reader.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:11:48
 */
import * as React from 'react';
import {IBookContent, loadBook} from '../utils';

import css from '../styles/reader.module.less';
import {Viewer} from './Viewer';
import {TBookType} from '../../interfaces/protocols';

export interface IReaderProps {
  name: string;
  type: TBookType;
  filePath: string;
  progress: number;
  onUpdateProgress(progress: number): void;
  onClose(): void;
}

type TState = 'Init' | 'Loading' | 'Ready';

export default function Reader(props: IReaderProps) {
  const [state, setState] = React.useState<TState>('Init');
  const [book, setBook] = React.useState<IBookContent>();

  React.useEffect(() => {
    if (state === 'Init') {
      setState('Loading');
      loadBook(props.filePath).then(content => {
        setBook(content);
        setState('Ready');
      }).catch(error => {
        console.error(error);
      })
    }
  });

  if (state !== 'Ready') {
    return (
      <div className={css.ready}>
        Loading {props.name}...
      </div>
    );
  }

  return (
    <div className={css.reader}>
      <Viewer
        type={props.type}
        content={book.content}
      />
    </div>
  );
}
