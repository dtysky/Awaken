/**
 * @File   : Tools.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:09:30
 */
import * as React from 'react';
import {IconButton, Modal, TextArea} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {changeNote, checkNoteMark, ENoteAction, INoteMarkStatus, splitCFI} from './common';
import { IBookNote } from '../../interfaces/protocols';

interface IToolsProps {
  notes: IBookNote[];
  cfi: string;
  rendition: ePub.Rendition;
  content: ePub.Contents;
  onChangeNotes(notes: IBookNote[]): void;
}

let preCFI: string;
export function Tools(props: IToolsProps) {
  const [show, setShow] = React.useState<boolean>(false);
  const [showModal, setShowModal] = React.useState<boolean>(false);
  const [annotation, setAnnotation] = React.useState<string>('');
  const [note, setNote] = React.useState<IBookNote>();
  const [status, setStatus] = React.useState<INoteMarkStatus>();
  const [x, setX] = React.useState<number>();
  const [y, setY] = React.useState<number>();

  React.useEffect(() => {
    if (!props.cfi || preCFI === props.cfi) {
      return;
    }

    const {rendition, content, cfi, notes} = props;
    const [start, end] = splitCFI(cfi);
    const status = checkNoteMark(notes, start, end);
    setStatus(status);

    const range: Range = content.range(cfi);
    if (status.exist) {
      const note = notes[status.index];
      setNote(note);
      setAnnotation(note.annotation);
    } else {
      rendition.annotations.add('highlight', cfi);
      const page = rendition.book.locations.locationFromCfi(cfi) as unknown as number;
      const note = {
        cfi: cfi, start, end, page,
        text: range.toString(),
        annotation: '', modified: Date.now()
      };
      changeNote(props.notes, note, status, ENoteAction.Add);
      setNote(note);
    }

    preCFI = cfi;
    const {x, y, width, height} = range.getBoundingClientRect();
    const cw = document.getElementById('epub-viewer').clientWidth;

    setX(x % cw + width / 2);
    setY(y + height / 2);
    setShow(true);
  });

  return (
    <div
      className={css.tools}
      style={{display: show ? 'block' : 'none'}}
      onClick={() => {
        setShow(false);
        props.onChangeNotes(props.notes);
      }}
    >
        <div
          className={css.toolsMenu}
          style={{left: x, top: y}}
        >
          <IconButton
            type='error'
            onClick={() => {
              changeNote(props.notes, note, status, ENoteAction.Delete);
              props.rendition.annotations.remove(note.cfi, 'highlight');
              props.onChangeNotes(props.notes);
            }}
          />
          <IconButton
            type='copy'
            onClick={() => navigator.clipboard.writeText(note.text + '\n\n' + note.annotation)}
          />
          <IconButton
            type='edit'
            onClick={() => setShowModal(true)}
          />
        </div>

        <Modal
          show={showModal}
          confirm={() => {
            note.annotation = annotation;
            changeNote(props.notes, note, status, ENoteAction.Update);
            setNote(note);
            setShowModal(false);
          }}
          cancel={() => {
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
