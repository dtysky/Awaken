/**
 * @File   : App.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:07:42
 */
import * as React from 'react';
import Reader from './reader/Reader';

import {IBook} from '../interfaces/protocols';
import Books from './books/Books';
import {IConfig, loadConfig, saveBooks} from './utils';

import css from './styles/app.module.scss';
import './styles/global.scss';

type TState = 'Loading' | 'Books' | 'Reader';

export default function App() {
  const [config, setConfig] = React.useState<IConfig>({
    settings: undefined,
    books: []
  });
  const [state, setState] = React.useState<TState>('Loading');
  const [current, setCurrent] = React.useState<number>(0);

  React.useEffect(() => {
    if (state === 'Loading') {
      loadConfig().then(config => {
        setConfig({
          settings: config.settings,
          books: config.books
        });
        setState('Books');
      }) 
    }
  });

  if (state === 'Loading') {
    return (
      <div className={css.loading}>
        <div>Awaken Loading...</div>
      </div>
    );
  }

  if (state === 'Books') {
    return (
      <Books
        settings={config.settings}
        books={config.books}
        onSelect={index => {
          setCurrent(index);
          setState('Reader');
        }}
        onChangeBooks={(books, remove) => {}}
        onUpdateSettings={settings => {}}
      />
    );
  }

  return (
    <Reader
      filePath={config.books[current].filePath}
      name={config.books[current].name}
      type={config.books[current].type}
      progress={config.books[current].progress}
      onUpdateProgress={progress => {
        config.books[current].progress = progress;
        saveBooks(config.settings.folder, config.books);
      }}
      onClose={() => setState('Books')}
    />
  );
}
