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
import {IBookIndex} from './types';
import { Indexes } from './Indexes';
import { Menu } from './Menu';

export interface IReaderProps {
  name: string;
  type: TBookType;
  filePath: string;
  progress: number;
  onUpdateProgress(progress: number): void;
  onClose(): void;
}

type TState = 'Init' | 'Loading' | 'Parser' | 'Ready';

export default function Reader(props: IReaderProps) {
  const [state, setState] = React.useState<TState>('Init');
  const [book, setBook] = React.useState<IBookContent>();
  const [indexes, setIndexes] = React.useState<IBookIndex[]>();
  const [currentIndex, setCurrentIndex] = React.useState<IBookIndex>();
  const [showMenu, setShowMenu] = React.useState<boolean>(false);

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

  if (state === 'Init' || state === 'Loading') {
    return (
      <div className={css.ready}>
        Loading {props.name}...
      </div>
    );
  }

  return (
    <div className={css.reader}>
      <div className={css.top}>
        <Menu
          onSwitch={() => setShowMenu(!showMenu)}
          onReturn={props.onClose}
        />
      </div>
      <div className={css.bottom}>
        <div className={`${css.indexes} ${showMenu && css.indexesShow}`}>
          <div className={css.indexesTop}>目录</div>
          <Indexes
            indexes={indexes}
            current={currentIndex}
            onSelect={index => setCurrentIndex(index)}
          />
        </div>
        <Viewer
          type={props.type}
          index={currentIndex}
          onLoad={(indexes, current) => {
            setIndexes(indexes);
            setCurrentIndex(current);
          }}
          content={book.content}
        />
      </div>
    </div>
  );
}
