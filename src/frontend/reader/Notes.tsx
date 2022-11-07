/**
 * @File   : Notes.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/10/29 22:07:26
 */
import * as React from 'react';
import {Modal, TextArea, Postcard, IconButton} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {changeNote, ENoteAction, IBookNoteParsed} from './common';

interface INotesProps {
  bookmarks: IBookNoteParsed[];
  notes: IBookNoteParsed[];
  onJump(note: IBookNoteParsed): void;
}

export function Notes(props: INotesProps) {
  const [showModal, setShowModal] = React.useState<boolean>(false);
  const [noteIndex, setNoteIndex] = React.useState<number>();
  const [annotation, setAnnotation] = React.useState<string>('');

  return (
    <div className={css.notesContent}>
      <>
      {
        props.bookmarks.map(item => (
          <div
            key={item.cfi}
            className={`${css.notesItem} ${css.noteBookmark}`}
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
        props.notes.map((item, index) => (
          <div
            key={item.cfi}
            className={css.notesItem}
          >
            <Postcard
              title="笔记"
              subtitle={`第${item.page}页`}
            >
              <div className={css.notesActions}>
                <IconButton
                  type='copy'
                  onClick={() => navigator.clipboard.writeText(item.text + '\n\n' + item.annotation)}
                />
                <IconButton
                  type='edit'
                  onClick={() => {
                    setNoteIndex(index);
                    setShowModal(true);
                  }}
                />
              </div>
              <div
                className={css.notesText}
                onClick={() => props.onJump(item)}
              >
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

      <Modal
        show={showModal}
        confirm={() => {
          const note = props.notes[noteIndex];
          note.annotation = annotation;
          changeNote(props.notes, note, {exist: true, index: noteIndex}, ENoteAction.Update);
          setShowModal(false);
        }}
        cancel={() => {
          const note = props.notes[noteIndex];
          setAnnotation(note.annotation);
          setShowModal(false);
        }}
      >
        <TextArea
          value={annotation}
          onChange={e => setAnnotation((e.target as any).value)}
        />
      </Modal>
    </div>
  )
}
