/**
 * @File   : Books.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:12:26
 */
import * as React from 'react';
import ColorHash from 'color-hash'
import { IconButton, Modal, Select, Option } from 'hana-ui';

import bk from '../../backend';
import { IBook } from '../../interfaces/protocols';
import { Menu } from './Menu';
import { ISystemSettings } from '../../interfaces';

import css from '../styles/books.module.scss';


export interface IBooksProps {
  bookshelfList: [string[], React.Dispatch<React.SetStateAction<string[]>>];
  settings: ISystemSettings;
  books: [IBook[], React.Dispatch<React.SetStateAction<IBook[]>>];
  downloaded: {[hash: string]: boolean};
  onDownload(book: IBook): Promise<void>;
  onMoveBook(book: IBook, shelf: string | null): void;
  onSelect(index: number): void;
  onUpdateSettings(config: ISystemSettings): void;
  onAddBooks(files: string[]): void;
  onRemoveBook(book: IBook): void;
  onImportBookNotes(book: IBook): void;
  onSync(): void;
  onSyncAll(): void;
}

export default function Books(props: IBooksProps) {
  const [showDelete, setShowDelete] = React.useState<boolean>(false);
  const [bookDelete, setBookDelete] = React.useState<IBook>();
  const [isOnAddToBookshelf, setIsOnAddToBookshelf] = React.useState<boolean>(false);
  const [addToBookshelfBook, setAddToBookshelfBook] = React.useState<string>();
  const [bookAddToBookshelf, setBookAddToBookshelf] = React.useState<IBook>();
  const [selectedBookshelf, setSelectedBookshelf] = React.useState<string>(null);
  const [bookshelfList, setBookshelfList] = props.bookshelfList;
  const [books, setBooks] = props.books;

  return (
    <div className={css.books}>
      <Menu
        bookshelfListState={[bookshelfList, setBookshelfList]}
        selectedBookshelfState={[selectedBookshelf, setSelectedBookshelf]}
        settings={props.settings}
        onUpdateSettings={props.onUpdateSettings}
        onAddBooks={props.onAddBooks}
        onSync={props.onSync}
        onSyncAll={props.onSyncAll}
      />
      <div className={css.list}>
        {books.map((book, index) => !book.removed && (book.bookshelf?.value == selectedBookshelf) && (
          <Book
            key={book.hash}
            book={book}
            downloaded={!!props.downloaded[book.hash]}
            onDownload={() => props.onDownload(book)}
            onSelect={() => {
              props.onSelect(index)
            }}
            onDelete={() => {
              setBookDelete(book);
              setShowDelete(true);
            }}
            onImportNotes={() => {
              props.onImportBookNotes(book)
            }}
            onAddToBookshelf={() => {
              setIsOnAddToBookshelf(true);
              setBookAddToBookshelf(book);
            }}
          />
        ))}
      </div>

      <Modal
        show={showDelete}
        title='确认删除书籍？'
        titleStyle={{ color: 'red' }}
        contentStyle={{ color: 'red' }}
        confirm={() => {
          setShowDelete(false);
          props.onRemoveBook(bookDelete);
        }}
        cancel={() => setShowDelete(false)}
      >
        <p>书籍《{bookDelete?.name}》将会被删除。</p>
        <p>包括服务端副本，并会同步给所有终端。</p>
        <p>但笔记将会保留，再次添加相同书籍可恢复。</p>
      </Modal>

      {/* 添加到书架 */}
      <Modal
        show={isOnAddToBookshelf}
        title='添加到书架'
        confirm={() => {
          if (!bookAddToBookshelf || !addToBookshelfBook) { return; }
          props.onMoveBook(bookAddToBookshelf, addToBookshelfBook === '默认书架' ? null : addToBookshelfBook);
          setIsOnAddToBookshelf(false);
          setAddToBookshelfBook(undefined);
          setBookAddToBookshelf(undefined);
        }}
        cancel={() => setIsOnAddToBookshelf(false)}
      >
        <p>书籍《{bookAddToBookshelf?.name}》将会被移动到书架。</p>
        <br />
        <Select
          defaultLabel='选择书架'
          auto
          onSelect={(value) => {
            setAddToBookshelfBook(value);
          }}
        >
          <Option
            key='none'
            label='默认书架'
            value={'默认书架'}
          />
          {bookshelfList.map(bs => (
            <Option
              key={bs}
              label={bs}
              value={bs}
            />
          ))}
        </Select>
      </Modal>
    </div>
  );
}

interface IBookProps {
  book: IBook;
  downloaded: boolean;
  onDownload(): Promise<void>;
  onSelect(): void;
  onDelete(): void;
  onImportNotes(): void;
  onAddToBookshelf(): void;
}

const colorHash = new ColorHash();
function Book(props: IBookProps) {
  const [downloading, setDownloading] = React.useState(false);
  const [error, setError] = React.useState('');
  return (
    <div
      className={css.book}
      style={props.book.cover ? {
        backgroundImage: `url(${props.book.cover})`
      } : {
        backgroundColor: colorHash.hex(props.book.hash)
      }}
    >
      <div
        role="button" tabIndex={0} aria-label={`阅读《${props.book.name}》`}
        onKeyDown={event => { if (event.key === "Enter") { props.onSelect(); } }}
        className={css.bookBg}
        onClick={props.onSelect}
      >
        {
          !props.book.cover && (
            <div className={css.bookInfo}>
              <div className={css.bookName}>{props.book.name}</div>
              <div className={css.bookAuthor}>{props.book.author}</div>
            </div>
          )
        }
      </div>
      <div className={css.downloadStatus}>
        <span>{props.downloaded ? '已下载 · 离线可读' : downloading ? '下载中…' : '未下载'}</span>
        {!props.downloaded && <button type='button' disabled={downloading} onClick={async () => {
          setDownloading(true);
          setError('');
          try { await props.onDownload(); }
          catch (error) { setError(error.message || String(error)); }
          finally { setDownloading(false); }
        }}>{downloading ? '下载中…' : error ? '重试下载' : '下载到本机'}</button>}
        {error && <span className={css.downloadError} title={error}>{error}</span>}
      </div>
      {
        bk.supportAddDeleteBook && (
          <div className={css.bookActions}>
            <IconButton
              type='menu'
              size='large'
              onClick={props.onAddToBookshelf}
            />
            <IconButton
              type='offline'
              size='large'
              onClick={props.onImportNotes}
            />
            <IconButton
              type='close'
              size='large'
              onClick={props.onDelete}
            />
          </div>
        )
      }
    </div>
  )
}
