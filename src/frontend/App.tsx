/**
 * @File   : App.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:07:42
 */
import * as React from 'react';
import { Loading, Modal } from 'hana-ui';

import bk from '../backend';
import Reader from './reader/Reader';
import { IBook, IBookConfig } from '../interfaces/protocols';
import Books from './books/Books';
import {
  loadSettings, saveSettings, loadBooks,
  selectFolder, selectNote
} from './utils';
import webdav from './webdav';
import { ISystemSettings } from '../interfaces';

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
  const [bookshelfMap, setBookshelfMap] = React.useState<{ [hash: string]: string }>({});

  const loadAllBookshelves = async (books: IBook[]): Promise<{ [hash: string]: string }> => {
    const shelves: { [hash: string]: string } = {};

    for (const book of books) {
      if (book.removed) {
        continue;
      }

      try {
        const bookshelf = await webdav.syncBookshelf(book);

        shelves[book.hash] = bookshelf;
      } catch (error) {
        console.warn(`Failed to load bookshelf for book ${book.name}:`, error);
        shelves[book.hash] = null;
      }
    }

    return shelves;
  };

  React.useEffect(() => {
    if (state === 'Init') {
      setState('Loading');
      setLoadingInfo('初始化......');
      loadSettings().then(s => {
        let promise = new Promise<void>(resolve => resolve());
        if (!s.folder) {
          promise = selectFolder(true).then(folder => {
            console.log(folder)
            if (!folder) {
              throw new Error('必须选择一个文件夹！请退出应用后重新进入！')
            }

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
            setState('Books');
            setLoadingInfo('加载书架信息...');
            loadAllBookshelves(bks || []).then(m => {
              setBookshelfMap(m);
              setLoadingInfo('');
            });
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
          bookshelfMapState={[bookshelfMap, setBookshelfMap]}
          settings={settings}
          books={books}
          onSelect={async index => {
            setLoadingInfo('书籍打开中...');
            try {
              await webdav.checkAndDownloadBook(books[index], setLoadingInfo);
              setCurrent(index);
              setState('Reader');
              setLoadingInfo('');
            } catch (error) {
              bk.worker.showMessage(error.message, 'error');
              setLoadingInfo('');
            }
          }}
          onSync={async () => {
            try {
              if (!settings.webDav.url) {
                bk.worker.showMessage('未指定远端服务器地址！', 'error');
                return;
              }

              setLoadingInfo('尝试连接中...');
              if (!webdav.connected) {
                await webdav.changeRemote(settings.webDav);
              }

              const bks = await webdav.syncBooks(books, info => setLoadingInfo(info));

              setBooks(bks);
              setLoadingInfo('加载书架信息...');
              setBookshelfMap(await loadAllBookshelves(bks || []));
              setLoadingInfo('');
            } catch (error) {
              bk.worker.showMessage(`${error.message || error}`, 'error');
              setLoadingInfo('');
            }
          }}
          onAddBooks={async files => {
            if (!webdav.connected) {
              bk.worker.showMessage(`未连接到服务器，仅会添加到本地，待到连接时同步。`, 'warning');
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
                bk.worker.showMessage(invalid.join('\n'), 'error', '以下书籍添加报错');
              }
            }

            if (webdav.connected) {
              const bks = await webdav.syncBooks(books, info => setLoadingInfo(info));
              setBooks(bks);
            } else {
              setBooks(books);
            }

            setLoadingInfo('');
          }}
          onRemoveBook={async book => {
            setLoadingInfo('等待删除书籍...');
            let bks = await webdav.removeBook(book, books);
            bks = await webdav.syncBooks(bks, info => setLoadingInfo(info));
            setBooks(bks);
            setLoadingInfo('');
          }}
          onImportBookNotes={async book => {
            const fp = (await selectNote())[0];
            if (!fp) {
              return;
            }

            setLoadingInfo('开始导入笔记...');

            try {
              const failed = await webdav.importNotes(book, fp, setLoadingInfo);
              if (failed.length) {
                const str = failed.join('\n');
                navigator.clipboard.writeText(str);
                bk.worker.showMessage(`以下笔记自动导入失败，但已复制到剪切板，请手动标记（页数和位置为Kindle的，不是本软件的，供参考）：\n\n${str}`, 'warning');
              }
            } catch (error) {
              console.error(error)
              bk.worker.showMessage(`导入失败：${error.message}`, 'error');
            }

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
                bk.worker.showMessage(`${error.message || error}`, 'error');
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
        closeOnClickBg={false}
        title={'是否连接到服务器？'}
        confirm={async () => {
          setLoadingInfo('尝试连接中...');
          setShowModal(false);
          try {
            await webdav.changeRemote(settings.webDav);
            const bks = await webdav.syncBooks(books, info => setLoadingInfo(info));
            setBooks(bks);
            setLoadingInfo('加载书架信息...');
            setBookshelfMap(await loadAllBookshelves(bks || []));
            setLoadingInfo('');
          } catch (error) {
            bk.worker.showMessage(`${error.message || error}`, 'error');
            setLoadingInfo('');
          }
        }}
        cancel={() => setShowModal(false)}
      >
        检测到已保存的远端服务器
        <br />
        {settings?.webDav?.url}
      </Modal>
    </div>
  )
}