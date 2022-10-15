/**
 * @File   : PageCtr.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/27 23:50:18
 */
import * as React from 'react';
import {Slider} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {TBookType} from '../../interfaces/protocols';
import {IBookIndex} from './types';

interface IPageCtrProps {
  start: number;
  max: number;
  current: number;
  onChange(progress: number): void;
}

export function PageCtr(props: IPageCtrProps) {
  if (!props.max) {
    return null;
  }

  React.useEffect(() => {
    function processEvent(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        props.onChange(Math.max(props.current - 1, props.start));
      } else if (event.key === 'ArrowRight') {
        props.onChange(Math.min(props.current + 1, props.max));
      }
    }

    window.addEventListener('keydown', processEvent);

    return () => {
      window.removeEventListener('keydown', processEvent)
    };
  });

  return (
    <div className={css.pageCtr}>
      <div className={css.pageCtrPre} onClick={() => props.onChange(Math.max(props.current - 1, props.start))} />
      <div className={css.pageCtrNext} onClick={() => props.onChange(Math.min(props.current + 1, props.max))} />
      <div className={css.pageCtrSlider}>
        <Slider
          size='small'
          showValue={false}
          value={props.current}
          min={props.start}
          max={props.max}
          onChange={val => props.onChange(val)}
        />
      </div>
    </div>
  )
}
