import * as React from 'react';
import {Loading, Modal} from 'hana-ui';
import bk from '../backend';
import Reader from './reader/Reader';
import {IBook, IBookConfig} from '../interfaces/protocols';
import Books from './books/Books';
import {loadSettings, saveSettings, loadBooks, selectFolder, selectNote} from './utils';
import webdav, {IBookImportDuplicate} from './webdav';
import {ISystemSettings} from '../interfaces';
import SyncStatus from './SyncStatus';
import css from './styles/app.module.scss';
import './styles/global.scss';

export default function App() {
  const [settings, setSettings] = React.useState<ISystemSettings>();
  const [books, setBooks] = React.useState<IBook[]>([]);
  const [current, setCurrent] = React.useState<string>();
  const [loadingInfo, setLoadingInfo] = React.useState('初始化…');
  const [error, setError] = React.useState('');
  const [attempt, setAttempt] = React.useState(0);
  const [showConnect, setShowConnect] = React.useState(false);
  const [bookshelfList, setBookshelfList] = React.useState<string[]>([]);
  const [downloaded, setDownloaded] = React.useState<{[hash: string]: boolean}>({});
  const [syncRequest, setSyncRequest] = React.useState(0);
  const [importReport, setImportReport] = React.useState<{
    imported: number; skipped: number; duplicates: IBookImportDuplicate[]; failures: string[];
  }>();
  const [importEditions, setImportEditions] = React.useState<string[]>([]);
  const busy = React.useRef(false);
  const retryAll = React.useRef(false);
  const currentBook = books.find(book => book.hash === current);

  async function refresh(next: IBook[]) {
    setBooks([...next]);
    setBookshelfList(previous => Array.from(new Set([...previous,
      ...next.filter(book => !book.removed).map(book => book.bookshelf?.value).filter(Boolean)])));
    const entries = await Promise.all(next.filter(book => !book.removed).map(async book =>
      [book.hash, await webdav.isDownloaded(book)] as [string, boolean]));
    setDownloaded(Object.fromEntries(entries));
  }

  React.useEffect(() => {
    let active = true;
    (async () => {
      setError('');
      setLoadingInfo('初始化…');
      try {
        const saved = await loadSettings();
        if (!saved.folder) {
          saved.folder = await selectFolder(true);
          await saveSettings(saved);
        }
        await webdav.changeLocal(saved.folder);
        await webdav.initialize();
        const cached = await loadBooks();
        if (!active) { return; }
        setSettings(saved);
        await refresh(cached);
        setShowConnect(!!saved.webDav.url);
      } catch (error) {
        if (active) { setError(`初始化失败：${error.message || error}`); }
      } finally {
        if (active) { setLoadingInfo(''); }
      }
    })();
    return () => { active = false; };
  }, [attempt]);

  async function run(message: string, action: () => Promise<void>) {
    if (busy.current) { return; }
    busy.current = true;
    setLoadingInfo(message);
    try { await action(); }
    catch (error) { await bk.worker.showMessage(error.message || String(error), 'error'); }
    finally { busy.current = false; setLoadingInfo(''); }
  }

  async function sync(next = books, config = settings, all = false) {
    retryAll.current = all;
    if (!config.webDav.url) { throw new Error('请先在设定中填写 WebDAV 地址。'); }
    if (!webdav.connected) { await webdav.changeRemote(config.webDav); }
    try {
      if (all) { await webdav.syncAllBooks(next, setLoadingInfo); }
      else { await webdav.syncBooks(next, setLoadingInfo); }
    }
    finally { await refresh(next); }
  }

  async function saveAndSync(next: IBook[]) {
    await refresh(next);
    if (webdav.connected) { await sync(next); }
  }

  async function download(book: IBook) {
    if (!(await webdav.isDownloaded(book))) {
      if (!webdav.connected && settings.webDav.url) { await webdav.changeRemote(settings.webDav); }
      await webdav.checkAndDownloadBook(book);
    }
    setDownloaded(previous => ({...previous, [book.hash]: true}));
  }

  async function importBooks(files: string[], allowAnotherEdition = false) {
    await run('导入书籍…', async () => {
      const report = {imported: 0, skipped: 0, duplicates: [] as IBookImportDuplicate[], failures: [] as string[]};
      for (const file of new Set(files)) {
        try { await webdav.addBook(file, books, allowAnotherEdition); report.imported++; }
        catch (error) {
          const duplicate = error.duplicateBook as IBookImportDuplicate;
          if (duplicate?.identical) { report.skipped++; }
          else if (duplicate) { report.duplicates.push(duplicate); }
          else { report.failures.push(error.message || String(error)); }
        }
      }
      setImportEditions([]);
      setImportReport(report.skipped || report.duplicates.length || report.failures.length ? report : undefined);
      if (report.imported) { await saveAndSync(books); }
    });
  }

  async function closeReader(config?: IBookConfig) {
    await run('保存阅读进度…', async () => {
      if (config) {
        await webdav.saveConfig(currentBook, config);
        try { await webdav.syncBook(currentBook); } catch (error) { /* Retry remains available in the status bar. */ }
      }
      await webdav.setBookToTop(books, books.findIndex(book => book.hash === current));
      await bk.worker.setBackground(1, 1, 1);
      setSettings(await loadSettings());
      setCurrent(undefined);
      await refresh(books);
    });
  }

  return <div className={css.app}>
    {settings && <SyncStatus configured={!!settings.webDav.url} onRetry={() => {
      if (currentBook) { setSyncRequest(value => value + 1); }
      else { run('同步中…', () => sync(books, settings, retryAll.current || webdav.syncState?.allBooksPending)); }
    }} />}
    <div className={css.content}>
      {error && <div className={css.initError}><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>重试</button></div>}
      {settings && !currentBook && <Books
        bookshelfList={[bookshelfList, setBookshelfList]}
        settings={settings} books={[books, setBooks]} downloaded={downloaded}
        onDownload={download}
        onSelect={index => run('打开书籍…', async () => {
          await download(books[index]);
          setCurrent(books[index].hash);
        })}
        onSync={() => run('同步中…', () => sync())}
        onSyncAll={() => run('同步全部书籍…', () => sync(books, settings, true))}
        onAddBooks={files => importBooks(files)}
        onRemoveBook={book => run('删除书籍…', async () => {
          await webdav.removeBook(book, books);
          await saveAndSync(books);
        })}
        onMoveBook={async (book, shelf) => {
          if (busy.current) { throw new Error('正在处理其他操作，请稍后重试。'); }
          busy.current = true;
          try {
            const next = books.map(item => item.hash === book.hash ?
              {...item, bookshelf: {value: shelf, ts: Math.max(Date.now(), (item.bookshelf?.ts || 0) + 1)}} : item);
            // Keep the picker open on local write failure. A remote failure does
            // not undo a saved move; the sync status retains its retry action.
            await webdav.saveBooks(next);
            await refresh(next);
            if (webdav.connected) {
              try { await sync(next); } catch (_) { /* Saved locally; retry via sync status. */ }
            }
          } finally { busy.current = false; setLoadingInfo(''); }
        }}
        onImportBookNotes={book => run('导入笔记…', async () => {
          const file = (await selectNote())[0];
          if (!file) { return; }
          const failed = await webdav.importNotes(book, file, setLoadingInfo);
          if (failed.length) {
            const text = failed.join('\n');
            try { await navigator.clipboard.writeText(text); } catch (error) { /* The dialog also contains the text. */ }
            await bk.worker.showMessage(`以下笔记未能自动匹配，请手动标记：\n${text}`, 'warning');
          }
        })}
        onUpdateSettings={next => run('保存设置…', async () => {
          const changedRemote = ['url', 'user', 'password'].some(key => settings.webDav[key] !== next.webDav[key]);
          if (settings.folder !== next.folder) { await webdav.changeLocal(next.folder, setLoadingInfo); }
          await saveSettings(next);
          setSettings(next);
          if (changedRemote) {
            await webdav.changeRemote(next.webDav);
            if (next.webDav.url) { await sync(books, next); }
          }
        })}
      />}
      {currentBook && <Reader key={currentBook.hash} book={currentBook} onClose={closeReader}
        syncRequest={syncRequest} onConnect={async () => {
          if (!webdav.connected && settings.webDav.url) { await webdav.changeRemote(settings.webDav); }
          if (!webdav.connected) { throw new Error('请返回书库，在设定中连接 WebDAV。'); }
        }} />}
    </div>
    {loadingInfo && <Loading mode='queue' content={loadingInfo} />}
    <Modal show={showConnect} closeOnClickBg={false} title='连接服务器并同步？'
      confirm={() => { setShowConnect(false); run('连接服务器…', () => sync()); }}
      cancel={() => setShowConnect(false)}>
      <p>{settings?.webDav.url}</p><p>取消后仍可阅读已下载的书籍，修改会保存到本机。</p>
    </Modal>
    <Modal show={!!importReport} title='导入结果' closeOnClickBg={false}
      contentStyle={{maxHeight: '55vh'}}
      actions={<div className={css.importActions}>
        <button type='button' onClick={() => {setImportReport(undefined); setImportEditions([]);}}>
          {importReport?.duplicates.length ? '跳过重复项' : '关闭'}
        </button>
        {!!importEditions.length && <button type='button' onClick={() => {
          const files = [...importEditions];
          setImportReport(undefined); setImportEditions([]);
          void importBooks(files, true);
        }}>导入选中的 {importEditions.length} 本</button>}
      </div>}>
      {importReport && <div className={css.importReport}>
        <p>已导入 {importReport.imported} 本，跳过 {importReport.skipped} 本完全相同的文件。</p>
        {!!importReport.duplicates.length && <>
          <p>以下 {importReport.duplicates.length} 本与书库中的书名、作者相同，暂未导入。已有书籍、笔记和进度会保留。</p>
          <p>如果确实是需要保留的另一版本，可勾选后单独导入。</p>
          {importReport.duplicates.map(duplicate => <label key={duplicate.file} className={css.importDuplicate}>
            <input type='checkbox' checked={importEditions.includes(duplicate.file)} onChange={event => {
              const checked = event.target.checked;
              setImportEditions(previous => checked ? [...previous, duplicate.file] : previous.filter(file => file !== duplicate.file));
            }} />
            <span><strong>《{duplicate.name}》</strong>
              <small>{duplicate.author || '作者未填写'}</small>
              <small>已有 {duplicate.matches.length} 个版本 · {Array.from(new Set(duplicate.matches.map(book => book.bookshelf?.value || '默认书架'))).join('、')}</small>
              <small title={duplicate.file}>导入文件：{duplicate.file.split(/[\\/]/).pop()}</small>
              <span>仍作为另一版本导入</span>
            </span>
          </label>)}
        </>}
        {!!importReport.failures.length && <div className={css.importFailures}>
          <p>以下文件未能导入：</p>{importReport.failures.map((failure, index) => <p key={index}>{failure}</p>)}
        </div>}
      </div>}
    </Modal>
  </div>;
}
