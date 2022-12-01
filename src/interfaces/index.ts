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
  light: number;
  font: string;
  fontSize: number;
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
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '虚无',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '永恒',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '无常',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '明镜',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '觉醒',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '信念',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '渴望',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '土地',
    color: '#000000',
    background: '#fbf0d9',
    highlight: '#66cc99',
  },
  {
    name: '星空',
    color: '#000000',
    background: '#fbf0d9',
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
    name: '斜阳',
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
