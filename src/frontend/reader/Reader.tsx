/**
 * @File   : Reader.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:11:48
 */
import * as React from 'react';
import {Sidebar} from 'hana-ui';

import {IBookContent, loadBook} from '../utils';
import {Viewer} from './Viewer';
import {TBookType} from '../../interfaces/protocols';
import {IBookIndex} from './types';
import {Indexes} from './Indexes';
import {Menu} from './Menu';

import css from '../styles/reader.module.scss';
import { PageCtr } from './PageCtr';

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
        <div>
          {showMenu && (
            <div
              className={`${css.indexesBg}`}
              onClick={() => setShowMenu(false)}
            />
        )}
          <Sidebar
            className={`${css.indexes}`}
            open={showMenu}
          >
            <Indexes
              indexes={indexes}
              current={currentIndex}
              onSelect={index => setCurrentIndex(index)}
            />
          </Sidebar>
        </div>
        <Viewer
          type={props.type}
          index={currentIndex}
          onLoad={(indexes) => {
            setIndexes(indexes);
            setCurrentIndex(indexes[0]);
          }}
          content={book.content}
        />
        <PageCtr
          max={100}
          current={1}
          onChange={(progress) => {
            console.log(progress)
          }}
        />
      </div>
    </div>
  );
}
