/**
 * @File   : Menu.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:08:40
 */
import * as React from 'react';

import css from '../styles/reader.module.less';

interface IMenuProps {
  onSwitch(): void;
  onReturn(): void;
}

export function Menu(props: IMenuProps) {
  return (
    <div className={css.menu}>
      <div
        className={`${css.menuItem} ${css.menuIndex}`}
        onClick={props.onSwitch}
      >
        目录
      </div>
      <div
        className={`${css.menuItem} ${css.menuReturn}`}
        onClick={props.onReturn}
      >
        返回
      </div>
    </div>
  )
}
