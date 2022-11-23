/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:10
 */
export interface ISystemSettings {
  folder: string;
  webDav: {
    url: string;
    user: string;
    password: string;
  };
  read: {
    font: string;
    fontSize: number;
    lineSpace: number;
    color: string;
    background: string;
    light: number;
  };
}
