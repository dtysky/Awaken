/**
 * @File   : PageCtr.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/27 23:50:18
 */
import * as React from 'react';
import {Icon, Slider} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {TBookType} from '../../interfaces/protocols';

interface IPageCtrProps {
  start: number;
  max: number;
  current: number;
  onJump(progress: number): void;
  onPre(): void;
  onNext(): void;
}

export function PageCtr(props: IPageCtrProps) {
  if (!props.max) {
    return null;
  }

  React.useEffect(() => {
    function processEvent(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        props.onPre();
      } else if (event.key === 'ArrowRight') {
        props.onNext();
      }
    }

    window.addEventListener('keydown', processEvent);

    return () => {
      window.removeEventListener('keydown', processEvent)
    };
  });

  return (
    <div className={css.pageCtr}>
      <div className={css.pageCtrPre} onClick={props.onPre} />
      <div className={css.pageCtrNext} onClick={props.onNext} />
      <div className={css.pageCtrSlider}>
        <Slider
          size='small'
          icon={<Icon type='clover' color='#6c9' />}
          color={'#6c9'}
          showValue={false}
          value={props.current}
          min={props.start}
          max={props.max}
          //@todo throttle
          onChange={val => props.onJump(val)}
        />
      </div>
    </div>
  )
}
