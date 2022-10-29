/**
 * @File   : Menu.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:08:40
 */
import * as React from 'react';
import {ButtonGroup, Button} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {INoteMarkStatus} from './common';

interface IMenuProps {
  bookmarkStatus?: INoteMarkStatus;
  onIndexes(): void;
  onNotes(): void;
  onReturn(): void;
  onBookmark(): void;
}

export function Menu(props: IMenuProps) {
  return (
    <ButtonGroup className={css.menu}>
      <Button
        className={css.menuItem}
        type={'error'}
        onClick={props.onReturn}
      >
        返回
      </Button>
      <Button
        className={css.menuItem}
        onClick={props.onIndexes}
      >
        目录
      </Button>
      <Button
        className={css.menuItem}
        onClick={props.onNotes}
      >
        笔记
      </Button>
      <Button
        className={css.menuItem}
        onClick={props.onBookmark}
        type={props.bookmarkStatus?.exist ? 'primary' : 'default'}
        disabled={!props.bookmarkStatus}
      >
        书签
      </Button>
    </ButtonGroup>
  )
}
