/**
 * @File   : types.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/20 23:32:25
 */
export interface IBookIndex {
  id: string | number;
  label: string;
  children: IBookIndex[];
}
