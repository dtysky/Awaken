/**
 * @File   : Menu.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:08:40
 */
import * as React from 'react';
import {ButtonGroup, Button, IconButton} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {INoteMarkStatus} from './common';

interface IMenuProps {
  bookmarkStatus?: INoteMarkStatus;
  onReturn(): void;
  onSync(): void;
  onIndexes(): void;
  onNotes(): void;
  onBookmark(): void;
}

export function Menu(props: IMenuProps) {
  return (
    <ButtonGroup className={css.menu}>
      <IconButton
        //@ts-ignore
        className={css.menuItem}
        type={'backward'}
        onClick={props.onReturn}
      />
      <IconButton
        //@ts-ignore
        className={css.menuItem}
        type={'deploy'}
        onClick={props.onSync}
      />
      <IconButton
        //@ts-ignore
        className={css.menuItem}
        type={'list'}
        onClick={props.onIndexes}
      />
      <IconButton
        //@ts-ignore
        className={css.menuItem}
        type={'log'}
        onClick={props.onNotes}
      />
      <IconButton
        //@ts-ignore
        className={css.menuItem}
        onClick={props.onBookmark}
        type={'paint'}
        iconStyle={{color: props.bookmarkStatus?.exist ? '#6c9' : 'black'}}
        disabled={!props.bookmarkStatus}
      />
    </ButtonGroup>
  )
}
