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
  const [range, setRange] = React.useState<{start: number, max: number}>();
  const [progress, setProgress] = React.useState<number>(1);
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
          content={book.content}
          index={currentIndex}
          progress={progress}
          onLoad={(indexes, start, max) => {
            setIndexes(indexes);
            setCurrentIndex(indexes[0]);
            setRange({start, max});
          }}
          onProgress={progress => setProgress(progress)}
        />
        {
          range && (
            <PageCtr
              start={range.start}
              max={range.max}
              current={progress}
              onChange={(p) => setProgress(p)}
            />
          )
        }
      </div>
    </div>
  );
}
