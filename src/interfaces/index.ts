/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:10
 */
export interface ISystemConfig {
  folder: string;
  webDav: {
    user: string;
    password: string;
  };
  read: {
    font: string;
    fontSize: number;
    lineSpace: number;
    background: string;
    light: number;
  };
}
