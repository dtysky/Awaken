/**
 * @File   : Tools.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:09:30
 */
import * as React from 'react';
import ePub, {EpubCFI} from 'epubjs';
import {IconButton} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {checkNoteMark, ENoteAction, IBookNoteParsed, splitCFI} from './common';

interface IToolsProps {
  notes: IBookNoteParsed[];
  cfi: string;
  rendition: ePub.Rendition;
  content: ePub.Contents;
  onChangeNotes(notes: IBookNoteParsed[]): void;
}

let preCFI: string;
export function Tools(props: IToolsProps) {
  const [show, setShow] = React.useState<boolean>(false);
  const [note, setNote] = React.useState<IBookNoteParsed>();
  const [x, setX] = React.useState<number>();
  const [y, setY] = React.useState<number>();

  React.useEffect(() => {
    if (!props.cfi || preCFI === props.cfi) {
      return;
    }

    const {rendition, content, cfi, notes} = props;
    const [start, end] = splitCFI(cfi);
    const status = checkNoteMark(notes, start, end);
    console.log(status);

    const range: Range = content.range(cfi);
    if (status.exist) {
      setNote(notes[status.index]);
    } else {
      rendition.annotations.add('highlight', cfi);
      const page = rendition.book.locations.locationFromCfi(cfi) as unknown as number;
      setNote({
        cfi: cfi, start, end, page,
        text: range.toString(),
        annotation: ''
      });
    }

    preCFI = cfi;
    const {x, y, width, height} = range.getBoundingClientRect();

    setX(x + width / 2);
    setY(y + height / 2);
    setShow(true);

    // if (action === ENoteAction.Delete) {
    //   rendition.annotations.remove(note.cfi, 'highlight');
    // } else if (action === ENoteAction.Add) {
    //   rendition.annotations.add('highlight', note.cfi);
    //   note.text = preContent.range(note.cfi).toString();
    //   console.log(note);
    // }
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
          />
          <IconButton
            type='edit'
          />
        </div>
    </div>
  )
}
