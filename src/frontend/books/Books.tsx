/**
 * @File   : Books.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:12:26
 */
import * as React from 'react';
import {IBook} from '../../interfaces/protocols';
import ColorHash from 'color-hash'

import css from '../styles/books.module.less';

export interface IBooksProps {
  books: IBook[];
  onSelect(index: number): void;
}

export default function Books(props: IBooksProps) {
  return (
    <div className={css.books}>
      <div className={css.list}>
        {props.books.map((book, index) => (
          <Book
            key={book.hash}
            book={book}
            onSelect={() => {
              props.onSelect(index)
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface IBookProps {
  book: IBook;
  onSelect(): void;
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
      onClick={props.onSelect}
    >
      <div className={css.bookInfo}>
        <div className={css.bookName}>{props.book.name}</div>
        <div className={css.bookAuthor}>{props.book.author}</div>
      </div>
    </div>
  )
}
