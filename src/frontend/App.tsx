/**
 * @File   : App.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:07:42
 */
import * as React from 'react';
import {Loading, Notifications} from 'hana-ui';

import Reader from './reader/Reader';
import {IBook} from '../interfaces/protocols';
import Books from './books/Books';
import {
  loadSettings, saveSettings, loadBooks, saveBooks,
  selectFolder, selectBook
} from './utils';
import webdav from './webdav';
import {ISystemSettings} from '../interfaces';

import css from './styles/app.module.scss';
import './styles/global.scss';

type TState = 'Init' | 'Loading' | 'Books' | 'Reader';

// 'H:/ComplexMind/Awaken/test'

export default function App() {
  const [settings, setSettings] = React.useState<ISystemSettings>();
  const [books, setBooks] = React.useState<IBook[]>();
  const [state, setState] = React.useState<TState>('Init');
  const [current, setCurrent] = React.useState<number>(0);
  const [loadingInfo, setLoadingInfo] = React.useState<string>();
  const [notify, setNotify] = React.useState<{
    type: 'info' | 'success' | 'error' | 'warning';
    content: React.ReactNode;
    duration: number;
  }>();

  React.useEffect(() => {
    if (state === 'Init') {
      setState('Loading');
      setLoadingInfo('初始化......');
      loadSettings().then(s => {
        let promise = new Promise<void>(resolve => resolve());
        if (!s.folder) {
          promise = selectFolder(true).then(folder => {
            s.folder = folder;
            return saveSettings(s);
          });
        }

        promise.then(() => {
          webdav.changeLocal(s.folder);
          setSettings(s);

          return loadBooks();
        }).then(bks => {
          if (webdav.connected) {
            return webdav.syncBooks(bks);
          }

          return bks;
        }).then(bks => {
          setBooks(bks);
          setLoadingInfo('');
          setState('Books');
        });
      }) 
    }
  });

  return (
    <div className={css.app}>
      {state === 'Loading' && (
        <div className={css.loading}>
        </div>  
      )}
      {state === 'Books' && (
        <Books
          settings={settings}
          books={books}
          onSelect={index => {
            setCurrent(index);
            setState('Reader');
          }}
          onChangeBooks={(bks, remove) => {}}
          onUpdateSettings={async s => {
            let webDavChanged = settings.webDav.url !== s.webDav.url ||
              settings.webDav.user !== s.webDav.user;
            let folderChanged = settings.folder !== s.folder;

            if (!webDavChanged && !folderChanged) {
              setSettings(s);
              return;
            }

            if (folderChanged) {
              setLoadingInfo('修改书籍目录，拷贝文件...');
              try {
                await webdav.changeLocal(settings.folder);
              } catch (error) {
                s.folder = settings.folder;
                setNotify({type: 'error', content: `修改本地目录失败： ${error.message}`, duration: 4});
              }
            }

            if (webDavChanged) {
              setLoadingInfo('连接服务器...');
              try {
                // await webdav.changeRemote(settings.webDav.url, settings.webDav.user, settings.webDav.password)
                await webdav.changeRemote('http://127.0.0.1:8888/dav', 'dtysky', '114514');
                setLoadingInfo('连接成功，开始同步文件...');
                await webdav.syncBooks(books);
              } catch (error) {
                s.webDav = Object.assign({}, settings.webDav);
                setNotify({type: 'error', content: `连接失败： ${error.message}`, duration: 4});
              }
            }
            setLoadingInfo('');
            setSettings(s);
          }}
        />
      )}
      {state === 'Reader' && (
        <Reader
          filePath={books[current].filePath}
          name={books[current].name}
          type={books[current].type}
          progress={books[current].progress}
          onUpdateProgress={progress => {
            books[current].progress = progress;
            saveBooks(settings.folder, books);
          }}
          onClose={() => setState('Books')}
        />
      )}

      {loadingInfo && <Loading mode='queue' content={loadingInfo} />}

      <Notifications notification={notify} />
    </div>
  )
}
