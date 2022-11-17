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
  loadSettings, saveSettings, loadBooks,
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
          if (s.webDav.url) {
            return webdav.changeRemote(s.webDav.url, s.webDav.url, s.webDav.user);
          }

          return undefined;
        }).then(() => {
          webdav.changeLocal(s.folder);
          setSettings(s);

          return loadBooks();
        })
        .then(bks => {
          if (webdav.connected) {
            return webdav.syncBooks(bks);
          }

          return bks;
        }).then(bks => {
          setBooks(bks);
          setLoadingInfo('');
          setState('Books');
        }).catch(error => {
          setNotify({type: 'error', content: `初始化失败：${error.message}`, duration: 4});
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
          onAddBooks={async files => {
            if (!webdav.connected) {
              setNotify({type: 'error', content: `未连接到服务器，请现在“设定”中配置。`, duration: 4});
              return;
            }

            setLoadingInfo('准备添加书籍...');
            for (const file of files) {
              setLoadingInfo(`${file} 添加中...`);
              await webdav.addBook(file, books);
              setLoadingInfo(`${file} 添加结束...`);
            }

            const bks = await webdav.syncBooks(books);
            setBooks(bks);
            setLoadingInfo('');
          }}
          onRemoveBook={file => {}}
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
                await webdav.changeRemote(s.webDav.url, s.webDav.user, s.webDav.password)
                setLoadingInfo('连接成功，开始同步文件...');
                await webdav.syncBooks(books);
              } catch (error) {
                s.webDav = Object.assign({}, settings.webDav);
                setNotify({type: 'error', content: `连接失败： ${error.message}`, duration: 4});
              }
            }

            await saveSettings(s);
            setSettings(s);
            setLoadingInfo('');
          }}
        />
      )}
      {state === 'Reader' && (
        <Reader
          book={books[current]}
          onClose={async bookConfig => {
            setLoadingInfo('与远端同步笔记和进度...');
            await webdav.syncBook(books[current], bookConfig);
            setState('Books');
            setLoadingInfo('');
          }}
        />
      )}

      {loadingInfo && <Loading mode='queue' content={loadingInfo} />}

      <Notifications notification={notify} />
    </div>
  )
}