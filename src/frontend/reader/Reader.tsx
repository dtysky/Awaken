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
import {IBookNote, TBookType} from '../../interfaces/protocols';
import {changeBookmark, checkNoteMark, IBookIndex, INoteMarkStatus} from './common';
import {Menu} from './Menu';
import {Indexes} from './Indexes';
import {Notes} from './Notes';
import {PageCtr} from './PageCtr';

import css from '../styles/reader.module.scss';

export interface IReaderProps {
  name: string;
  type: TBookType;
  filePath: string;
  progress: number;
  onUpdateProgress(progress: number): void;
  onClose(): void;
}

type TState = 'Init' | 'Loading' | 'Parser' | 'Ready';

let jump: (cfi: string) => void;
export default function Reader(props: IReaderProps) {
  const [state, setState] = React.useState<TState>('Init');
  const [content, setContent] = React.useState<ArrayBuffer>();
  const [bookmarks, setBookmarks] = React.useState<IBookNote[]>([]);
  const [notes, setNotes] = React.useState<IBookNote[]>([]);
  const [indexes, setIndexes] = React.useState<IBookIndex[]>();
  const [currentIndex, setCurrentIndex] = React.useState<IBookIndex>();
  const [range, setRange] = React.useState<{start: number, max: number}>();
  const [progress, setProgress] = React.useState<number>(1);
  const [bookmarkInfo, setBookmarkInfo] = React.useState<IBookNote>();
  const [bookmarkStatus, setBookmarkStatus] = React.useState<INoteMarkStatus>();
  const [showIndexes, setShowIndexes] = React.useState<boolean>(false);
  const [showNotes, setShowNotes] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (state === 'Init') {
      setState('Loading');
      loadBook(props.filePath).then(book => {
        setContent(book.content);
        setBookmarks(book.config.bookmarks);
        setNotes(book.config.notes);
        setState('Ready');
      }).catch(error => {
        console.error(error);
      })

      return;
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
          bookmarkStatus={bookmarkStatus}
          onIndexes={() => setShowIndexes(!showIndexes)}
          onNotes={() => setShowNotes(!showNotes)}
          onReturn={props.onClose}
          onBookmark={() => {
            setBookmarkStatus(changeBookmark(bookmarks, bookmarkInfo, bookmarkStatus));
          }}
        />
      </div>
      <div className={css.bottom}>
        <div>
          {(showIndexes || showNotes) && (
            <div
              className={`${css.indexesBg}`}
              onClick={() => {
                setShowIndexes(false);
                setShowNotes(false);
              }}
            />
          )}
          <Sidebar
            className={`${css.indexes}`}
            open={showIndexes}
          >
            <Indexes
              indexes={indexes}
              current={currentIndex}
              onSelect={index => setCurrentIndex(index)}
            />
          </Sidebar>
          <Sidebar
            className={`${css.notes}`}
            open={showNotes}
            position={'right' as any}
          >
            <Notes
              bookmarks={bookmarks}
              notes={notes}
              onJump={note => jump?.(note.cfi)}
            />
          </Sidebar>
        </div>
        <Viewer
          content={content}
          bookmarks={bookmarks}
          notes={notes}
          index={currentIndex}
          progress={progress}
          onLoad={(indexes, start, max, jumpTo) => {
            setIndexes(indexes);
            setCurrentIndex(indexes[0]);
            setRange({start, max});
            jump = jumpTo;
          }}
          onProgress={progress => setProgress(progress)}
          onBookmarkInfo={info => {
            if (info !== bookmarkInfo) {
              setBookmarkInfo(info);
              setBookmarkStatus(checkNoteMark(bookmarks, info.cfi));
            }
          }}
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
