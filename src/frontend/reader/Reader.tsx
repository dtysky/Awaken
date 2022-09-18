/**
 * @File   : Reader.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:11:48
 */
import * as React from 'react';
import { TBookType } from '../../interfaces/protocols';

export interface IReaderProps {
  type: TBookType;
  filePath: string;
  progress: number;
  onUpdateProgress(progress: number): void;
  onClose(): void;
}

export default function Reader(props: IReaderProps) {
  return (
    <div>
      
    </div>
  );
}
