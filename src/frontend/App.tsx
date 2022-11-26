/**
 * @File   : App.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:07:42
 */
import * as React from 'react';
import {Loading, Modal} from 'hana-ui';

import bk from '../backend';
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

export default function App() {
  const [settings, setSettings] = React.useState<ISystemSettings>();
  const [books, setBooks] = React.useState<IBook[]>();
  const [state, setState] = React.useState<TState>('Init');
  const [current, setCurrent] = React.useState<number>(0);
  const [loadingInfo, setLoadingInfo] = React.useState<string>();
  const [showModal, setShowModal] = React.useState<boolean>(false);

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

        promise
          .then(() => webdav.changeLocal(s.folder))
          .then(() => {
            setSettings(s);
            return loadBooks();
          })
          .then(bks => {
            setBooks(bks);
            setLoadingInfo('');
            setState('Books');

            if (s.webDav.url) {
              setShowModal(true);
            }
          })
          .catch(error => {
            bk.worker.showMessage(`初始化失败：${error.message}`, 'error');
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
          onSelect={async index => {
            setLoadingInfo('书籍打开中...');
            const res = await webdav.checkAndDownloadBook(books[index]);
            if (!res) {
              setCurrent(index);
              setState('Reader');
              setLoadingInfo('');
            } else {
              bk.worker.showMessage(res, 'error');
              setLoadingInfo('');
            }
          }}
          onSync={async () => {
            if (!webdav.connected && settings.webDav.url) {
              await webdav.changeRemote(settings.webDav);
            }

            const bks = await webdav.syncBooks(books, info => setLoadingInfo(info));
            setBooks(bks);
            setLoadingInfo('');
          }}
          onAddBooks={async files => {
            if (!webdav.connected) {
              bk.worker.showMessage(`未连接到服务器，请现在“设定”中配置。`, 'error');
              return;
            }

            setLoadingInfo('准备添加书籍...');
            const invalid: string[] = [];
            for (const file of files) {
              setLoadingInfo(`${file} 添加中...`);
              try {
                await webdav.addBook(file, books);
              } catch (error) {
                console.error(error)
                invalid.push(error.message);
              }

              if (invalid.length) {
                bk.worker.showMessage(invalid.join('\n'), 'warning', '以下书籍添加报错');
              }
            }

            const bks = await webdav.syncBooks(books, info => setLoadingInfo(info));
            setBooks(bks);
            setLoadingInfo('');
          }}
          onRemoveBook={async book => {
            setLoadingInfo('等待删除书籍...');
            let bks = await webdav.removeBook(book, books);
            bks = await webdav.syncBooks(bks, info => setLoadingInfo(info));
            setBooks(bks);
            setLoadingInfo('');
          }}
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
                await webdav.changeLocal(s.folder, info => setLoadingInfo(info));
              } catch (error) {
                s.folder = settings.folder;
                console.error(error, s);
                bk.worker.showMessage(`修改本地目录失败： ${error.message || error}`, 'error');
              }
            }

            if (webDavChanged) {
              setLoadingInfo('连接服务器...');
              try {
                await webdav.changeRemote(s.webDav);
                setLoadingInfo('连接成功，开始同步文件...');
                const bks = await webdav.syncBooks(books, info => setLoadingInfo(info));
                setBooks(bks);
              } catch (error) {
                s.webDav = Object.assign({}, settings.webDav);
                bk.worker.showMessage(`连接失败： ${error.message || error}`, 'error');
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
            setLoadingInfo('合并与同步笔记和进度到远端...');
            await webdav.syncBook(books[current], bookConfig);
            await webdav.setBookToTop(books, current);
            bk.worker.setBackground(1, 1, 1);
            setState('Books');
            setLoadingInfo('');
          }}
        />
      )}

      {loadingInfo && (
        <Loading
          mode='queue'
          content={loadingInfo}
        />
      )}

      <Modal
        show={showModal}
        title={'是否连接到服务器？'}
        confirm={async () => {
          // need user's action to connect server
          setLoadingInfo('准备连接...')
          setShowModal(false);
          await webdav.changeRemote(settings.webDav);
          const bks = await webdav.syncBooks(books, info => setLoadingInfo(info));
          setBooks(bks);
          setLoadingInfo('');
        }}
        cancel={() => setShowModal(false)}
      >
        检测到已保存的远端服务器
        <br/>
        {settings?.webDav?.url}
      </Modal>
    </div>
  )
}