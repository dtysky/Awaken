/**
 * @File   : Indexes.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:10:40
 */
import * as React from 'react';

import css from '../styles/reader.module.less';
import {TBookType} from '../../interfaces/protocols';
import {IBookIndex} from './types';

interface IIndexesProps {
  layer?: number;
  indexes: IBookIndex[];
  onSelect(index: IBookIndex): void;
}

export function Indexes(props: IIndexesProps) {
  if (!props.indexes) {
    return null;
  }

  return (
    <>
      {props.indexes.map(index => (
        <div
          className={`${css.index} ${css['index-' + (props.layer || 0)]}`}
          key={index.id}
          onClick={() => props.onSelect(index)}
        >
          {index.label}
          {index.children && (
            <Indexes
              key={index.id}
              layer={(props.layer || 0) + 1}
              onSelect={props.onSelect}
              indexes={index.children}
            />
          )}
        </div>
      ))}
    </>
  )
}
