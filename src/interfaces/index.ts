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
    color: '#dddddd',
    background: '#880610',
    highlight: '#ccb500',
  },
  {
    name: '瞬光',
    color: '#000000',
    background: '#ffffff',
    highlight: '#66cc99',
  },
  {
    name: '寂暗',
    color: '#ffffff',
    background: '#000000',
    highlight: '#66cc99',
  },
  {
    name: '存在',
    color: '#FBF4DD',
    background: '#E1D6B8',
    highlight: '#66cc99',
  },
  {
    name: '虚无',
    color: '#ffffff',
    background: '#7C7C7C',
    highlight: '#66cc99',
  },
  {
    name: '永恒',
    color: '#ffffff',
    background: '#606fba',
    highlight: '#66cc99',
  },
  {
    name: '无常',
    color: '#000000',
    background: '#728BC9',
    highlight: '#66cc99',
  },
  {
    name: '明镜',
    color: '#000000',
    background: '#F3F4FC',
    highlight: '#66cc99',
  },
  {
    name: '信念',
    color: '#000000',
    background: '#EEE9D5',
    highlight: '#66cc99',
  },
  {
    name: '渴望',
    color: '#ffffff',
    background: '#34E374',
    highlight: '#66cc99',
  },
  {
    name: '土地',
    color: '#000000',
    background: '#F2CB84',
    highlight: '#66cc99',
  },
  {
    name: '星空',
    color: '#FFD2A1',
    background: '#041C2C',
    highlight: '#66cc99',
  },
  {
    name: '纯洁',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '混沌',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '荒诞',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '戏谑',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '愤怒',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '叹息',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '烟火',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '向日葵',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '彼岸花',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '懵懂',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '青鸟',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
];
