import * as React from 'react';
import webdav from './webdav';
import css from './styles/app.module.scss';

export default function SyncStatus(props: {onRetry(): void; configured: boolean}) {
  const [state, setState] = React.useState(webdav.syncState);
  React.useEffect(() => webdav.subscribe(setState), []);
  const labels = {
    local: '已保存到本机', pending: '已保存到本机 · 待同步',
    syncing: '正在同步…', synced: '已同步', error: '同步失败 · 本机数据已保留'
  };
  return <div className={css.syncStatus} role='status' aria-live='polite'>
    <div>
      <strong className={state.phase === 'error' ? css.syncError : ''}>{labels[state.phase]}</strong>
      <span className={css.syncDetail}>
        {state.bookCount !== undefined && `书库：${state.bookCount} 本 · `}
        {state.allBooksPending && '全部书籍待同步 · '}
        {state.lastSync ? `上次成功：${new Date(state.lastSync).toLocaleString('zh-CN')}` : '尚未完成同步'}
        {!props.configured && ' · 可在设定中连接 WebDAV'}
      </span>
      {state.error && <span className={css.syncError} title={state.error}>{state.error}</span>}
    </div>
    {props.configured && (state.phase === 'pending' || state.phase === 'error') &&
      <button type='button' onClick={props.onRetry}>{state.phase === 'error' ? '重试同步' : '立即同步'}</button>}
  </div>;
}
