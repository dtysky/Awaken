import * as React from 'react';
import {createPortal} from 'react-dom';
import {IBook} from '../../interfaces/protocols';
import css from '../styles/books.module.scss';

interface IShelfPickerProps {
  book: IBook;
  books: IBook[];
  shelves: string[];
  onMove(shelf: string | null): Promise<void>;
  onClose(): void;
}

export default function ShelfPicker({book, books, shelves, onMove, onClose}: IShelfPickerProps) {
  const [query, setQuery] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const dialog = React.useRef<HTMLDivElement>(null);
  const pending = React.useRef(false);
  const titleId = React.useId();
  const searchId = React.useId();
  const name = query.trim();
  const current = book.bookshelf?.value || null;
  const options = [null, ...Array.from(new Set([...shelves,
    ...books.filter(item => !item.removed).map(item => item.bookshelf?.value), current]))
    .filter(value => !!value && value !== '默认书架')];
  const visible = options.filter(value => (value || '默认书架').toLocaleLowerCase().includes(name.toLocaleLowerCase()));
  const canCreate = !!name && !options.some(value => (value || '默认书架') === name);

  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.current?.querySelector('input')?.focus();
    return () => { if (previous?.isConnected) { previous.focus(); } };
  }, []);

  const close = () => { if (!pending.current) { onClose(); } };
  const move = async (shelf: string | null) => {
    if (pending.current || shelf === current) { return; }
    pending.current = true;
    setSaving(true);
    setError('');
    try { await onMove(shelf); onClose(); }
    catch (error) { setError(error.message || String(error)); }
    finally { pending.current = false; setSaving(false); }
  };

  return createPortal(<div className={css.shelfOverlay} onClick={event => {
    if (event.target === event.currentTarget) { close(); }
  }}>
    <div ref={dialog} role='dialog' aria-modal='true' aria-labelledby={titleId} aria-busy={saving}
      className={css.shelfPicker} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key !== 'Tab') { return; }
        const targets = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));
        if (!targets.length) { event.preventDefault(); return; }
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <header className={css.shelfPickerHeader}>
        <h2 id={titleId}>移入书架</h2>
        <button type='button' onClick={close} disabled={saving} aria-label='关闭书架选择'>×</button>
      </header>
      <p className={css.shelfBookTitle}>《{book.name}》</p>
      <p className={css.shelfHint}>当前：{current || '默认书架'} · 点击书架即可移入</p>
      <form className={css.shelfSearch} onSubmit={event => {
        event.preventDefault();
        // Enter creates a new shelf or chooses an exact match; partial searches
        // never silently choose a different shelf. Ignore IME confirmation.
        if (canCreate) { void move(name); }
        else if (name) {
          const match = options.find(value => (value || '默认书架') === name);
          if (match !== undefined) { void move(match); }
        }
      }}>
        <label htmlFor={searchId}>搜索或新建书架</label>
        <input id={searchId} type='search' value={query} disabled={saving} autoComplete='off'
          placeholder='输入书架名称' onChange={event => {setQuery(event.target.value); setError('');}}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) { event.preventDefault(); }
          }} />
        {canCreate && <button className={css.shelfCreate} type='submit' disabled={saving}>
          <span aria-hidden='true'>＋</span><span>新建“{name}”并移入</span>
        </button>}
      </form>
      <div className={css.shelfOptions} aria-label='可选书架'>
        {visible.map(shelf => <button type='button' key={shelf || ''} disabled={saving || shelf === current}
          className={`${css.shelfOption} ${shelf === current ? css.shelfOptionCurrent : ''}`}
          onClick={() => { void move(shelf); }}>
          <span>{shelf || '默认书架'}</span>
          <small>{shelf === current ? '当前书架 · ' : ''}{books.filter(item => !item.removed && (item.bookshelf?.value || null) === shelf).length} 本</small>
        </button>)}
        {!visible.length && <p className={css.shelfHint}>没有同名书架，可在上方直接新建并移入。</p>}
      </div>
      {error && <p className={css.shelfMoveError} role='alert'>{error}</p>}
      <footer className={css.shelfPickerFooter}>
        <span role='status'>{saving ? '正在保存…' : '移动后可随时换到其他书架'}</span>
        <button type='button' disabled={saving} onClick={close}>取消</button>
      </footer>
    </div>
  </div>, document.body);
}
