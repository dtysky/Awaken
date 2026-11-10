/**
 * @File   : Reader.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:11:48
 */
import * as React from 'react';
import {Sidebar, Loading, Modal} from 'hana-ui';

import bk from '../../backend';
import webdav from '../webdav';
import {EJumpAction, Viewer} from './Viewer';
import {IBook, IBookConfig, IBookNote, } from '../../interfaces/protocols';
import {buildStyleUrl, changeNote, checkNoteMark, IBookIndex, INoteMarkStatus} from './common';
import {Menu} from './Menu';
import {Indexes} from './Indexes';
import {Notes} from './Notes';
import {PageCtr} from './PageCtr';

import css from '../styles/reader.module.scss';
import {IReadSettings} from '../../interfaces';

export interface IReaderProps {
  book: IBook;
  onClose(config?: IBookConfig): void;
  onConnect(): Promise<void>;
  syncRequest: number;
}

type TState = 'Init' | 'Loading' | 'Parser' | 'Ready';

export default function Reader(props: IReaderProps) {
  const [state, setState] = React.useState<TState>('Init');
  const [readSettings, setReadSettings] = React.useState<IReadSettings>();
  const [bookStyle, setBookStyle] = React.useState<string>();
  const [content, setContent] = React.useState<ArrayBuffer>();
  const [pages, setPages] = React.useState<string>();
  const [pagesLen, setPagesLen] = React.useState<number>(0);
  const [config, setConfig] = React.useState<IBookConfig>();
  const latest = React.useRef<IBookConfig>();
  const jump = React.useRef<(action: EJumpAction, target?: string | number | IBookIndex) => void>();
  const syncNotes = React.useRef<(previous: IBookNote[], next: IBookNote[]) => void>();
  const {bookmarks = [], notes = [], progress = 0, lastProgress = 0, ts = 0} = config || {};
  const [indexes, setIndexes] = React.useState<IBookIndex[]>();
  const [currentIndex, setCurrentIndex] = React.useState<IBookIndex>();
  const [range, setRange] = React.useState<{start: number, max: number}>();
  const [error, setError] = React.useState('');
  const [showJumpModal, setShowJumpModal] = React.useState<boolean>(false);
  const [bookmarkInfo, setBookmarkInfo] = React.useState<IBookNote>();
  const [bookmarkStatus, setBookmarkStatus] = React.useState<INoteMarkStatus>();
  const [showIndexes, setShowIndexes] = React.useState<boolean>(false);
  const [showNotes, setShowNotes] = React.useState<boolean>(false);
  const [loadingInfo, setLoadingInfo] = React.useState<string>('');

  const saveConfig = () => latest.current ? webdav.saveConfig(props.book, latest.current) : Promise.resolve();
  const updateConfig = (patch: Partial<IBookConfig>) => {
    if (!latest.current) { return; }
    latest.current = {...latest.current, ...patch};
    setConfig(latest.current);
    saveConfig().catch(error => setError(`保存失败：${error.message || error}`));
  };
  const synchronize = async () => {
    if (!latest.current) { return; }
    setLoadingInfo('同步中…');
    try {
      await saveConfig();
      await props.onConnect();
      const result = await webdav.syncBook(props.book);
      syncNotes.current?.(latest.current.notes, result.notes);
      latest.current = result;
      setConfig(result);
    } catch (error) {
      bk.worker.showMessage(`同步未完成，已保留本机数据：${error.message || error}`, 'warning');
    } finally { setLoadingInfo(''); }
  };
  const previousSyncRequest = React.useRef(props.syncRequest);
  React.useEffect(() => {
    if (props.syncRequest !== previousSyncRequest.current) {
      previousSyncRequest.current = props.syncRequest;
      synchronize();
    }
  }, [props.syncRequest]);

  const applyReadSettings = async (rSettings: IReadSettings) => {
    const {background, highlight} = rSettings;
    await bk.worker.setBackground(
      parseInt(background.substring(1, 3), 16) / 255,
      parseInt(background.substring(3, 5), 16) / 255, 
      parseInt(background.substring(5, 7), 16) / 255
    );
    const sheet = document.getElementById('global-style') as HTMLStyleElement;
    sheet.textContent = `g.awaken-highlight {fill: ${highlight} !important;fill-opacity: 0.5;}`;
    setBookStyle(buildStyleUrl(rSettings));
    setReadSettings(rSettings);
  }

  React.useEffect(() => {
    let active = true;
    setState('Loading');
    setLoadingInfo(`书籍《${props.book.name}》加载中…`);
    bk.worker.onAppHide(() => { saveConfig().catch(error => setError(`保存失败：${error.message || error}`)); });
    (async () => {
      try {
        const settings = await bk.worker.loadSettings();
        await applyReadSettings(settings.read);
        const loaded = await webdav.loadBook(props.book);
        if (!active) { return; }
        latest.current = loaded.config;
        setConfig(loaded.config);
        setContent(loaded.content);
        setPages(loaded.pages);
        setState('Ready');
      } catch (error) {
        if (active) { setError(`加载失败：${error.message || error}`); setLoadingInfo(''); }
      }
    })();
    return () => { active = false; bk.worker.onAppHide(() => {}); };
  }, [props.book.hash]);

  return (
    <div
      className={css.reader}
      style={{background: readSettings?.background}}
      onBlur={() => { saveConfig().catch(error => setError(`保存失败：${error.message || error}`)); }}
    >
      {error && <div className={css.readerError} role='alert'>
        <p>{error}</p><button onClick={() => props.onClose(latest.current)}>返回书库</button>
      </div>}
      {
        state === 'Ready' && (
          <>
            <div
              className={css.top}
              style={{color: readSettings?.color}}
            >
              <Menu
                readSettings={readSettings}
                bookmarkStatus={bookmarkStatus}
                onUpdateSettings={async rSettings => {
                  setLoadingInfo('阅读设置应用中...');
                  try {
                    const settings = await bk.worker.loadSettings();
                    settings.read = rSettings;
                    await bk.worker.saveSettings(settings);
                    await applyReadSettings(rSettings);
                  } catch (error) {
                    setError(`保存设置失败：${error.message || error}`);
                  } finally { setLoadingInfo(''); }
                }}
                onReturn={() => props.onClose(latest.current)}
                onSync={synchronize}
                onIndexes={() => {
                  setShowIndexes(!showIndexes);
                  setShowNotes(false);
                }}
                onNotes={() => {
                  setShowNotes(!showNotes);
                  setShowIndexes(false);
                }}
                onBookmark={() => {
                  setBookmarkStatus(changeNote(bookmarks, bookmarkInfo, bookmarkStatus));
                  updateConfig({bookmarks: [...bookmarks]});
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
                  className={`${css.notes} ${showIndexes ? css.notesIndexes : css.notesNotes}`}
                  open={showIndexes || showNotes}
                >
                  {
                    showIndexes ? (
                      <Indexes
                        indexes={indexes}
                        current={currentIndex}
                        onSelect={index => {
                          jump.current?.(EJumpAction.Index, index);
                          setCurrentIndex(index);
                        }}
                      />
                    ) : showNotes ? (
                      <Notes
                        bookmarks={bookmarks}
                        notes={notes}
                        pagesLen={pagesLen}
                        onChangeNotes={next => updateConfig({notes: [...next]})}
                        onJump={note => jump.current?.(EJumpAction.CFI, note.start)}
                      />    
                    ) : null
                  }
                </Sidebar>
              </div>
              <Viewer
                bookStyle={bookStyle}
                content={content}
                pages={pages}
                bookmarks={bookmarks}
                notes={notes}
                onError={error => { setError(`阅读器错误：${error.message || error}`); setLoadingInfo(''); }}
                onLoad={async (indexes, pgs, jumpTo, syncNotesX) => {
                  if (!pages) {
                    await webdav.savePages(props.book, pgs);
                  }
                  setPagesLen(pgs.length);
                  setIndexes(indexes);
                  setCurrentIndex(indexes[0]);
                  setRange({start: 0, max: Math.max(0, pgs.length - 1)});
                  jump.current = jumpTo;
                  syncNotes.current = syncNotesX;
                  jump.current?.(EJumpAction.Page, progress);

                  if (lastProgress !== progress) {
                    setShowJumpModal(true);
                  }

                  setLoadingInfo('');
                }}
                onBookmarkInfo={(info, withProgress) => {
                  if (info !== bookmarkInfo) {
                    setBookmarkInfo(info);
                    setBookmarkStatus(checkNoteMark(bookmarks, info.start, info.end));
                  }

                  if (withProgress) {
                    updateConfig({ts: Date.now(), progress: info.page, lastProgress: info.page});
                  }
                }}
                onChangeNotes={newNotes => {
                  updateConfig({notes: [...newNotes]});
                }}
              />
              {
                range && (
                  <PageCtr
                    color={readSettings.highlight}
                    start={range.start}
                    max={range.max}
                    current={progress}
                    onPre={() => jump.current?.(EJumpAction.Pre)}
                    onNext={() => jump.current?.(EJumpAction.Next)}
                    onJump={p => {
                      updateConfig({ts: Date.now(), progress: p, lastProgress: p});
                      jump.current?.(EJumpAction.Page, p)
                    }}
                  />
                )
              }
            </div>
          </>
        )
      }

      {loadingInfo && (
        <Loading
          mode='queue'
          content={loadingInfo}
        />
      )}

      <Modal
        show={showJumpModal}
        closeOnClickBg={false}
        confirm={() => {
          jump.current?.(EJumpAction.Page, lastProgress);
          updateConfig({ts: Date.now(), progress: lastProgress, lastProgress});
          setShowJumpModal(false);
        }}
        cancel={() => {
          updateConfig({ts: Date.now(), lastProgress: progress});
          setShowJumpModal(false);
        }}
      >
        检测到最新阅读进度{lastProgress}，当前{progress}，是否跳转？
      </Modal>
    </div>
  );
}
