/**
 * @File   : Menu.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:08:40
 */
import * as React from 'react';
import {ButtonGroup, Button} from 'hana-ui';

import css from '../styles/reader.module.scss';

interface IMenuProps {
  onSwitch(): void;
  onReturn(): void;
}

export function Menu(props: IMenuProps) {
  return (
    <ButtonGroup className={css.menu}>
      <Button
        className={css.menuItem}
        onClick={props.onSwitch}
      >
        目录
      </Button>
      <Button
        className={css.menuItem}
        type={'error'}
        onClick={props.onReturn}
      >
        返回
      </Button>
    </ButtonGroup>
  )
}
