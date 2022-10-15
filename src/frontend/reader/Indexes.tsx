/**
 * @File   : Indexes.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:10:40
 */
import * as React from 'react';
import {Menu, SubMenu, MenuItem} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {TBookType} from '../../interfaces/protocols';
import {IBookIndex} from './types';

interface IIndexesProps {
  subIndex?: IBookIndex;
  indexes: IBookIndex[];
  current: IBookIndex;
  onSelect(index: IBookIndex): void;
}

export function Indexes(props: IIndexesProps) {
  if (!props.indexes) {
    return null;
  }

  const CLZ = props.subIndex ? SubMenu : Menu as any;

  return (
    <CLZ
      title={props.subIndex?.label}
      type="linear"
    >
      {
        props.subIndex && (
          <MenuItem
            key={props.subIndex.id}
            value={props.subIndex.id}
            active={props.current.id === props.subIndex.id}
            onClick={() => props.onSelect(props.subIndex)}
          >
            {props.subIndex.label}
          </MenuItem>
        )
      }

      {props.indexes.map(index => {
        if (index.children?.length) {
          return (
            <Indexes
              key={index.id}
              subIndex={index}
              onSelect={props.onSelect}
              current={props.current}
              indexes={index.children}
            />
          );
        }

        return (
          <MenuItem
            key={index.id}
            value={index.id}
            active={props.current.id === index.id}
            onClick={() => props.onSelect(index)}
          >
            {index.label}
          </MenuItem>
        );
      })}
    </CLZ>
  )
}
