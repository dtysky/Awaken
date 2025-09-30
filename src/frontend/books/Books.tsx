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
import { IBook, IBookConfig } from '../../interfaces/protocols';
import { Menu } from './Menu';
import { ISystemSettings } from '../../interfaces';

import css from '../styles/books.module.scss';
import webdav from '../webdav';

export interface IBooksProps {
  bookshelfList: [string[], React.Dispatch<React.SetStateAction<string[]>>];
  settings: ISystemSettings;
  books: [IBook[], React.Dispatch<React.SetStateAction<IBook[]>>];
  onSelect(index: number): void;
  onUpdateSettings(config: ISystemSettings): void;
  onAddBooks(files: string[]): void;
  onRemoveBook(book: IBook): void;
  onImportBookNotes(book: IBook): void;
  onSync(): void;
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
      />
      <div className={css.list}>
        {books.map((book, index) => !book.removed && (book.bookshelf?.value == selectedBookshelf) && (
          <Book
            key={book.hash}
            book={book}
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
        confirm={async () => {
          setIsOnAddToBookshelf(false);
          try {
            const configPath = `${bookAddToBookshelf.hash}/config.json`;
            let config: IBookConfig
            const exists = await bk.worker.fs.exists(configPath, 'Books');
            if (exists) {
              const configStr = await bk.worker.fs.readFile(configPath, 'utf8', 'Books') as string;
              config = JSON.parse(configStr);
            } else {
              config = {
                ts: Date.now(),
                lastProgress: 0,
                progress: 0,
                bookmarks: [],
                notes: []
              };
            }

            if (bookAddToBookshelf && addToBookshelfBook) {
              const updatedBooks = [
                ...books.filter(b => b.hash !== bookAddToBookshelf.hash),
                {
                  ...bookAddToBookshelf,
                  bookshelf: {
                    value: addToBookshelfBook === '默认书架' ? null : addToBookshelfBook,
                    ts: Date.now()
                  }
                }
              ];
              setBooks(updatedBooks);
              await webdav.syncBookshelf(updatedBooks);
            }
          } catch (e) {
            console.error(e);
          }
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
  onSelect(): void;
  onDelete(): void;
  onImportNotes(): void;
  onAddToBookshelf(): void;
}

const colorHash = new ColorHash();
function Book(props: IBookProps) {
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
