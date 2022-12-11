/**
 * @File   : Menu.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:08:40
 */
import * as React from 'react';
import {ButtonGroup, FormGroup, FormItem, Icon, IconButton, Modal, Slider} from 'hana-ui';

import css from '../styles/reader.module.scss';
import {INoteMarkStatus} from './common';
import {defaultThemes, IReadSettings} from '../../interfaces';

interface IMenuProps {
  readSettings: IReadSettings;
  bookmarkStatus?: INoteMarkStatus;
  onReturn(): void;
  onUpdateSettings(settings: IReadSettings): void;
  onSync(): void;
  onIndexes(): void;
  onNotes(): void;
  onBookmark(): void;
}

export function Menu(props: IMenuProps) {
  const [theme, setTheme] = React.useState<number>(0);
  const [fontSize, setFontSize] = React.useState<number>(1);
  const [letterSpace, setLetterSpace] = React.useState<number>(0.2);
  const [lineSpace, setLineSpace] = React.useState<number>(0);
  const [showSettings, setShowSettings] = React.useState<boolean>(false);

  return (
    <>
      <ButtonGroup className={css.menu}>
        <IconButton
          className={css.menuItem}
          type={'backward'}
          color={props.readSettings?.color}
          onClick={props.onReturn}
        />
        <IconButton
          className={css.menuItem}
          type={'gear'}
          color={props.readSettings?.color}
          onClick={() => {
            setTheme(props.readSettings.theme);
            setFontSize(props.readSettings.fontSize);
            setLetterSpace(props.readSettings.letterSpace || 0);
            setLineSpace(props.readSettings.lineSpace);
            setShowSettings(true);
          }}
        />
        <IconButton
          className={css.menuItem}
          type={'deploy'}
          color={props.readSettings?.color}
          onClick={props.onSync}
        />
        <IconButton
          className={css.menuItem}
          type={'list'}
          color={props.readSettings?.color}
          onClick={props.onIndexes}
        />
        <IconButton
          className={css.menuItem}
          type={'log'}
          color={props.readSettings?.color}
          onClick={props.onNotes}
        />
        <IconButton
          className={css.menuItem}
          onClick={props.onBookmark}
          type={'paint'}
          iconStyle={{color: props.bookmarkStatus?.exist ? props.readSettings?.highlight : props.readSettings?.color}}
          disabled={!props.bookmarkStatus}
        />
      </ButtonGroup>

      <Modal
        show={showSettings}
        closeOnClickBg={false}
        confirm={() => {
          props.onUpdateSettings({
            font: '',
            theme, fontSize, letterSpace, lineSpace,
            ...defaultThemes[theme]
          });
          setShowSettings(false);
        }}
        cancel={() => {
          setTheme(props.readSettings.theme);
          setFontSize(props.readSettings.fontSize);
          setLineSpace(props.readSettings.lineSpace);
          setShowSettings(false);
        }}
        showClose={false}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '1rem',
            margin: '1rem 0',
            background: defaultThemes[theme].background,
            color: defaultThemes[theme].color,
            fontSize: `${fontSize}rem`,
            lineHeight: `${fontSize + lineSpace}rem`,
            border: '1px solid #6c9'
          }}
        >
          <p>作为演员的时候，<br />我们<span style={{background: defaultThemes[theme].highlight}}>不可忘却愤怒</span>。</p>
          <p>作为观众的时候，<br />我们<span style={{background: defaultThemes[theme].highlight}}>不可忘却叹息</span>。</p>
        </div> 

        <FormGroup
          labelPosition='top'
          label="基础排版"
          elementStyle={{flexFlow: 'column'}}
        >
          <FormItem label="文字大小" status='normal'>
            <Slider
              size='small'
              style={{marginTop: '8px'}}
              showValue={false}
              icon={<Icon type='clover' color='#6c9' />}
              value={fontSize * 10}
              min={5}
              max={40}
              onChange={val => setFontSize(val / 10)}
            />
          </FormItem>
          <FormItem label="字间距" status='normal'>
            <Slider
              size='small'
              style={{marginTop: '8px'}}
              showValue={false}
              icon={<Icon type='clover' color='#6c9' />}
              value={lineSpace * 10}
              min={0}
              max={10}
              onChange={val => setLetterSpace(val / 10)}
            />
          </FormItem>
          <FormItem label="行间距" status='normal'>
            <Slider
              size='small'
              style={{marginTop: '8px'}}
              showValue={false}
              icon={<Icon type='clover' color='#6c9' />}
              value={lineSpace * 10}
              min={0}
              max={20}
              onChange={val => setLineSpace(val / 10)}
            />
          </FormItem>
        </FormGroup>

        <FormGroup
          labelPosition='top'
          label="主题"
          className={css.menuThemes}
          elementStyle={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between'
          }}
        >
          {
            defaultThemes.map((t, i) => (
              <div
                key={t.name}
                className={css.menuThemeItem}
                style={{
                  background: t.background,
                  color: t.color,
                  textDecorationColor: t.highlight,
                  borderColor: i === theme ? '#6c9' : '#ccc',
                }}
                onClick={() => setTheme(i)}
              >
                {t.name}
              </div>
            ))
          }
        </FormGroup>
      </Modal>
    </>
  )
}
