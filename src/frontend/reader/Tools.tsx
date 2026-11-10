/**
 * @File   : Tools.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:09:30
 */
import * as React from 'react';
import {IconButton, Modal, TextArea} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {changeNote, checkNoteMark, ENoteAction, splitCFI} from './common';
import {IBookNote} from '../../interfaces/protocols';

interface IToolsProps {
  notes: IBookNote[];
  cfi: string;
  rendition: ePub.Rendition;
  content: ePub.Contents;
  onChangeNotes(notes: IBookNote[]): void;
  onClose(): void;
  onError(error: Error): void;
}

export function Tools(props: IToolsProps) {
  const menu = React.useRef<HTMLDivElement>();
  const [show, setShow] = React.useState<boolean>(false);
  const [showModal, setShowModal] = React.useState<boolean>(false);
  const [annotation, setAnnotation] = React.useState<string>('');
  const [note, setNote] = React.useState<IBookNote>();
  const [x, setX] = React.useState<number>();
  const [y, setY] = React.useState<number>();

  React.useEffect(() => {
    const {rendition, content, cfi, notes} = props;
    if (!cfi || !content || !rendition) {
      setShow(false);
      return;
    }

    try {
      const [start, end] = splitCFI(cfi);
      const status = checkNoteMark(notes, start, end);
      const range = content.range(status.exist ? notes[status.index].cfi : cfi);
      if (status.exist) {
        setNote(notes[status.index]);
        setAnnotation(notes[status.index].annotation || '');
      } else {
        if (range.collapsed || !range.toString().trim()) { return; }
        rendition.annotations.add('highlight', cfi, undefined, undefined, 'awaken-highlight');
        const page = rendition.book.locations.locationFromCfi(cfi) as unknown as number;
        const note = {
          cfi: cfi, start, end, page,
          text: range.toString(),
          annotation: '', modified: Date.now()
        };
        const next = [...notes];
        changeNote(next, note, status, ENoteAction.Add);
        setAnnotation('');
        setNote(note);
        props.onChangeNotes(next);
      }

      const viewer = document.getElementById('epub-viewer').getBoundingClientRect();
      const parent = menu.current.parentElement.parentElement.getBoundingClientRect();
      const frame = (content.window.frameElement as HTMLElement).getBoundingClientRect();
      const rect = Array.from(range.getClientRects()).find(rect =>
        rect.right + frame.left > viewer.left && rect.left + frame.left < viewer.right &&
        rect.bottom + frame.top > viewer.top && rect.top + frame.top < viewer.bottom
      ) || range.getBoundingClientRect();
      const left = Math.max(viewer.left, rect.left + frame.left);
      const right = Math.min(viewer.right, rect.right + frame.left);
      setX((left + right) / 2 - parent.left);
      setY(rect.bottom + frame.top - parent.top + 8);
      content.window.getSelection()?.removeAllRanges();
      setShow(true);
    } catch (error) {
      setShow(false);
      props.onError(new Error(`标记失败：${error.message || error}`));
    }
  }, [props.cfi, props.content, props.rendition]);

  React.useLayoutEffect(() => {
    if (!show) { return; }
    const bounds = menu.current.parentElement.getBoundingClientRect();
    const {width, height} = menu.current.getBoundingClientRect();
    setX(value => Math.max(width / 2 + 8, Math.min(value, bounds.width - width / 2 - 8)));
    setY(value => Math.max(8, Math.min(value, bounds.height - height - 8)));
  }, [show, props.cfi]);

  const handleClose = () => {
    props.content?.window.getSelection()?.removeAllRanges();
    setShow(false);
    setShowModal(false);
    props.onClose();
  };

  const updateNote = (action: ENoteAction) => {
    const index = props.notes.findIndex(item => item.cfi === note.cfi);
    if (index < 0) { handleClose(); return; }
    const next = [...props.notes];
    const updated = {...next[index], annotation};
    changeNote(next, updated, {exist: !updated.removed, index}, action);
    props.onChangeNotes(next);
    setNote(updated);
  };

  return (
    <div
      className={css.tools}
      style={{display: show ? 'block' : 'none'}}
    >
        <div
          className={css.toolsBg}
          onMouseUp={handleClose}
          onTouchEnd={handleClose}
        />
        <div
          ref={menu}
          className={css.toolsMenu}
          style={{left: x, top: y}}
        >
          <IconButton
            type='error'
            onClick={() => {
              updateNote(ENoteAction.Delete);
              props.rendition.annotations.remove(note.cfi, 'highlight');
              handleClose();
            }}
          />
          <IconButton
            type='copy'
            onClick={() => navigator.clipboard.writeText(note.text + '\n\n' + (note.annotation || '')).catch(props.onError)}
          />
          <IconButton
            type='edit'
            onClick={() => setShowModal(true)}
          />
        </div>

        <Modal
          show={showModal}
          closeOnClickBg={false}
          confirm={() => {
            updateNote(ENoteAction.Update);
            setShowModal(false);
          }}
          cancel={() => {
            setAnnotation(note.annotation || '');
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
