/**
 * @File   : Reader.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:11:48
 */
import * as React from 'react';
import {Sidebar} from 'hana-ui';

import {IBookContent, loadBook} from '../utils';
import {EJumpAction, Viewer} from './Viewer';
import {IBookNote, TBookType} from '../../interfaces/protocols';
import {changeNote, checkNoteMark, convertBookNotes, IBookIndex, IBookNoteParsed, INoteMarkStatus, splitCFI} from './common';
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

let jump: (action: EJumpAction, cfiOrPageOrIndex?: string | number | IBookIndex) => void;
export default function Reader(props: IReaderProps) {
  const [state, setState] = React.useState<TState>('Init');
  const [content, setContent] = React.useState<ArrayBuffer>();
  const [bookmarks, setBookmarks] = React.useState<IBookNoteParsed[]>([]);
  const [notes, setNotes] = React.useState<IBookNoteParsed[]>([]);
  const [indexes, setIndexes] = React.useState<IBookIndex[]>();
  const [currentIndex, setCurrentIndex] = React.useState<IBookIndex>();
  const [range, setRange] = React.useState<{start: number, max: number}>();
  const [progress, setProgress] = React.useState<number>(1);
  const [bookmarkInfo, setBookmarkInfo] = React.useState<IBookNoteParsed>();
  const [bookmarkStatus, setBookmarkStatus] = React.useState<INoteMarkStatus>();
  const [showIndexes, setShowIndexes] = React.useState<boolean>(false);
  const [showNotes, setShowNotes] = React.useState<boolean>(false);
  const [showToolsCFI, setShowToolsCFI] = React.useState<string>('');

  React.useEffect(() => {
    if (state === 'Init') {
      setState('Loading');
      loadBook(props.filePath).then(book => {
        setContent(book.content);
        setBookmarks(convertBookNotes(book.config.bookmarks));
        setNotes(convertBookNotes(book.config.notes));
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
          onIndexes={() => {
            setShowIndexes(!showIndexes);
            setShowNotes(false);
          }}
          onNotes={() => {
            setShowNotes(!showNotes);
            setShowIndexes(false);
          }}
          onReturn={props.onClose}
          onBookmark={() => {
            setBookmarkStatus(changeNote(bookmarks, bookmarkInfo, bookmarkStatus));
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
            className={`${css.notes}`}
            open={showIndexes || showNotes}
          >
            {
              showIndexes ? (
                <Indexes
                  indexes={indexes}
                  current={currentIndex}
                  onSelect={index => {
                    jump(EJumpAction.Index, index);
                    setCurrentIndex(index);
                  }}
                />
              ) : showNotes ? (
                <Notes
                  bookmarks={bookmarks}
                  notes={notes}
                  onJump={note => jump?.(EJumpAction.CFI, note.start)}
                />    
              ) : null
            }
          </Sidebar>
        </div>
        <Viewer
          content={content}
          bookmarks={bookmarks}
          notes={notes}
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
              setBookmarkStatus(checkNoteMark(bookmarks, info.start, info.end));
            }
          }}
          onChangeNotes={setNotes}
        />
        {
          range && (
            <PageCtr
              start={range.start}
              max={range.max}
              current={progress}
              onPre={() => jump(EJumpAction.Pre)}
              onNext={() => jump(EJumpAction.Next)}
              onJump={p => {
                setProgress(p);
                jump(EJumpAction.Page, p)
              }}
            />
          )
        }
      </div>
    </div>
  );
}
