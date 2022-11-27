/**
 * @File   : Books.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:12:26
 */
import * as React from 'react';
import ColorHash from 'color-hash'
import {IconButton, Modal} from 'hana-ui';

import bk from '../../backend';
import {IBook} from '../../interfaces/protocols';
import {Menu} from './Menu';
import {ISystemSettings} from '../../interfaces';

import css from '../styles/books.module.scss';

export interface IBooksProps {
  settings: ISystemSettings;
  books: IBook[];
  onSelect(index: number): void;
  onUpdateSettings(config: ISystemSettings): void;
  onAddBooks(files: string[]): void;
  onRemoveBook(book: IBook): void;
  onSync(): void;
}

export default function Books(props: IBooksProps) {
  const [showDelete, setShowDelete] = React.useState<boolean>(false);
  const [bookDelete, setBookDelete] = React.useState<IBook>();

  return (
    <div className={css.books}>
      <Menu
        settings={props.settings}
        onUpdateSettings={props.onUpdateSettings}
        onAddBooks={props.onAddBooks}
        onSync={props.onSync}
      />
      <div className={css.list}>
        {props.books.map((book, index) => !book.removed && (
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
          />
        ))}
      </div>

      <Modal
        show={showDelete}
        title='确认删除书籍？'
        titleStyle={{color: 'red'}}
        contentStyle={{color: 'red'}}
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
    </div>
  );
}

interface IBookProps {
  book: IBook;
  onSelect(): void;
  onDelete(): void;
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
      {
        bk.supportAddDeleteBook && (
          <IconButton
            type='close'
            size='large'
            onClick={props.onDelete}
          />
        )
      }
      <div onClick={props.onSelect}>
        {
          !props.book.cover && (
            <div className={css.bookInfo}>
              <div className={css.bookName}>{props.book.name}</div>
              <div className={css.bookAuthor}>{props.book.author}</div>
            </div>
          )
        }
      </div>
    </div>
  )
}
