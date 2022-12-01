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
  const [light, setLight] = React.useState<number>(1);
  const [fontSize, setFontSize] = React.useState<number>(16);
  const [lineSpace, setLineSpace] = React.useState<number>(16);
  const [showSettings, setShowSettings] = React.useState<boolean>(false);

  return (
    <>
      <ButtonGroup className={css.menu}>
        <IconButton
          //@ts-ignore
          className={css.menuItem}
          type={'backward'}
          onClick={props.onReturn}
        />
        <IconButton
          //@ts-ignore
          className={css.menuItem}
          type={'gear'}
          onClick={() => {
            setTheme(props.readSettings.theme);
            setLight(props.readSettings.light);
            setFontSize(props.readSettings.fontSize);
            setLineSpace(props.readSettings.lineSpace);
            setShowSettings(true);
          }}
        />
        <IconButton
          //@ts-ignore
          className={css.menuItem}
          type={'deploy'}
          onClick={props.onSync}
        />
        <IconButton
          //@ts-ignore
          className={css.menuItem}
          type={'list'}
          onClick={props.onIndexes}
        />
        <IconButton
          //@ts-ignore
          className={css.menuItem}
          type={'log'}
          onClick={props.onNotes}
        />
        <IconButton
          //@ts-ignore
          className={css.menuItem}
          onClick={props.onBookmark}
          type={'paint'}
          iconStyle={{color: props.bookmarkStatus?.exist ? '#6c9' : 'black'}}
          disabled={!props.bookmarkStatus}
        />
      </ButtonGroup>

      <Modal
        show={showSettings}
        confirm={() => {
          props.onUpdateSettings({
            font: '',
            theme, light, fontSize, lineSpace,
            ...defaultThemes[theme]
          });
          setShowSettings(false);
        }}
        cancel={() => {
          setTheme(props.readSettings.theme);
          setLight(props.readSettings.light);
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
            lineHeight: `${fontSize + lineSpace}rem`
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
              color={'#6c9'}
              value={fontSize}
              min={0.5}
              max={4}
              onChange={setFontSize}
            />
          </FormItem>

          <FormItem label="行间距" status='normal'>
            <Slider
              size='small'
              style={{marginTop: '8px'}}
              showValue={false}
              icon={<Icon type='clover' color='#6c9' />}
              color={'#6c9'}
              value={lineSpace}
              min={0}
              max={4}
              onChange={setLineSpace}
            />
          </FormItem>

          <FormItem label="亮度" status='normal'>
            <Slider
              size='small'
              style={{marginTop: '8px'}}
              showValue={false}
              icon={<Icon type='clover' color='#6c9' />}
              color={'#6c9'}
              value={light}
              min={0}
              max={1}
              onChange={setLight}
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
            defaultThemes.map(t => (
              <div
                key={t.name}
                className={css.menuThemeItem}
                style={{
                  background: t.background,
                  color: t.color,
                  textDecorationColor: t.highlight
                }}
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
