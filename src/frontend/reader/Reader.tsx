/**
 * @File   : Reader.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:11:48
 */
import * as React from 'react';
import {TBookType} from '../../interfaces/protocols';
import {IBookContent, loadBook} from '../utils';

import css from '../styles/reader.module.less';

export interface IReaderProps {
  type: TBookType;
  name: string;
  filePath: string;
  progress: number;
  onUpdateProgress(progress: number): void;
  onClose(): void;
}

export default function Reader(props: IReaderProps) {
  const [ready, setReady] = React.useState<boolean>(false);
  const [book, setBook] = React.useState<IBookContent>();

  React.useEffect(() => {
    if (!ready) {
      loadBook(props.filePath).then(content => {
        console.log(content);
        setBook(content);
        setReady(true);
      }).catch(error => {
        console.error(error);
      })
    }
  });

  if (!ready) {
    return (
      <div className={css.ready}>
        Loading {props.name}...
      </div>
    );
  }

  return (
    <div className={css.reader}>
      {props.name}
    </div>
  );
}
