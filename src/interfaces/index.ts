/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/13 23:11:10
 */
export interface ITheme {
  name: string;
  color: string;
  background: string;
  highlight: string;
}

export interface IReadSettings extends ITheme {
  theme: number;
  font: string;
  fontSize: number;
  letterSpace: number;
  lineSpace: number;
}

export interface ISystemSettings {
  folder: string;
  webDav: {
    url: string;
    user: string;
    password: string;
  };
  read: IReadSettings;
}

export const defaultThemes: ITheme[] = [
  {
    name: '岁月',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '觉醒',
    color: '#fff3dc',
    background: '#880610',
    highlight: '#ffb394',
  },
  {
    name: '瞬光',
    color: '#400000',
    background: '#fffbee',
    highlight: '#ecf080',
  },
  {
    name: '寂暗',
    color: '#ffffff',
    background: '#000000',
    highlight: '#e2dede',
  },
  {
    name: '存在',
    color: '#000000',
    background: '#ffffff',
    highlight: '#a09e9e',
  },
  {
    name: '虚无',
    color: '#ffffff',
    background: '#7C7C7C',
    highlight: '#e3dddd',
  },
  {
    name: '永恒',
    color: '#ffffff',
    background: '#0F4C81',
    highlight: '#3677dd',
  },
  {
    name: '荒诞',
    color: '#222222',
    background: '#cccbda',
    highlight: '#8775ad',
  },
  {
    name: '信念',
    color: '#fffef0',
    background: '#46b08c',
    highlight: '#87e7b1',
  },
  {
    name: '星空',
    color: '#FFD2A1',
    background: '#041C2C',
    highlight: '#52759e',
  },
  {
    name: '烟火',
    color: '#333333',
    background: '#fbdfc9',
    highlight: '#e8ae79',
  },
  {
    name: '叹息',
    color: '#ffffff',
    background: '#85aab3',
    highlight: '#4d8391',
  },
  {
    name: '懵懂',
    color: '#333333',
    background: '#FEDCDA',
    highlight: '#ff8a9d',
  },
  {
    name: '青鸟',
    color: '#222222',
    background: '#c3edbf',
    highlight: '#21d5b7',
  },
  {
    name: '向日葵',
    color: '#fffdd4',
    background: '#387c5a',
    highlight: '#37e5bb',
  },
  {
    name: '彼岸花',
    color: '#ff0000',
    background: '#291c1c',
    highlight: '#b52424',
  },
];
