/**
 * @File   : Notes.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/29 22:07:26
 */
import * as React from 'react';
import {Card, Postcard} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {IBookNote} from '../../interfaces/protocols';

interface INotesProps {
  bookmarks: IBookNote[];
  notes: IBookNote[];
  onJump(note: IBookNote): void;
}

export function Notes(props: INotesProps) {
  return (
    <div className={css.notesContent}>
      <>
      {
        props.bookmarks.map(item => (
          <div
            key={item.cfi}
            className={css.notesItem}
            onClick={() => props.onJump(item)}
          >
            <Postcard
              title="书签"
              subtitle={`第${item.page}页`}
            />
          </div>
        ))
      }
      </>
      <>
      {
        props.notes.map(item => (
          <div
            key={item.cfi}
            className={css.notesItem}
            onClick={() => props.onJump(item)}
          >
            <Postcard
              title="笔记"
              subtitle={`第${item.page}页`}
            >
              <div className={css.notesText}>
                {item.text}
              </div>
              <div className={css.notesAnnotation}>
                {item.annotation}
              </div>
            </Postcard>
          </div>
        ))
      }
      </>
    </div>
  )
}
