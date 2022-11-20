/**
 * @File   : Menu.tsx
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/16 23:12:38
 */
import * as React from 'react';
import {ButtonGroup, Button, Modal, Form, FormItem, Text, FormGroup} from 'hana-ui';

import css from '../styles/books.module.scss';
import {ISystemSettings} from '../../interfaces';
import {IBook} from '../../interfaces/protocols';
import {selectBook, selectFolder} from '../utils';

interface IMenuProps {
  settings: ISystemSettings;
  onUpdateSettings(settings: ISystemSettings): void;
  onAddBooks(files: string[]): void;
  onSync(): void;
}

export function Menu(props: IMenuProps) {
  const [settings, setSettings] = React.useState<ISystemSettings>();
  const [showConfig, setShowConfig] = React.useState<boolean>(false);
  const [showConfirm, setShowConfirm] = React.useState<boolean>(false);
  const [confirmText, setConfirmText] = React.useState<string[]>([]);
  const [showAbout, setShowAbout] = React.useState<boolean>(false);
  const forceUpdate: () => void = React.useState({})[1].bind(null, {})

  return (
    <>
      <ButtonGroup className={css.menu}>
        <Button
          className={css.menuItem}
          onClick={() => {
            setSettings({
              folder: props.settings.folder,
              webDav: Object.assign({}, props.settings.webDav),
              read: Object.assign({}, props.settings.read)
            });
            setShowConfig(true);
          }}
        >
          设定
        </Button>
        <Button
          className={css.menuItem}
          onClick={props.onSync}
        >
          同步
        </Button>
        <Button
          className={css.menuItem}
          onClick={() => {
            selectBook().then(files => {
              files.length && props.onAddBooks(files)
            })
          }}
        >
          添加
        </Button>
        <Button
          className={css.menuItem}
          onClick={() => setShowAbout(true)}
        >
          关于
        </Button>
      </ButtonGroup>

      <Modal
        // contentStyle={{height: 200}}
        title={'设定'}
        show={showConfig}
        confirm={() => {
          const text: string[] = [];

          if (
            props.settings.webDav.url !== settings.webDav.url ||
            props.settings.webDav.user !== settings.webDav.user
          ) {
            text.push('WebDAV账号更新，重新同步远端书籍。');
          }

          if (props.settings.folder !== settings.folder) {
            text.push('本地路径更新，移动本地文件。');
          }

          if (!text.length) {
            props.onUpdateSettings(settings);
            setShowConfig(false);
          } else {
            setConfirmText(text);
            setShowConfirm(true);
          }
        }}
        cancel={() => setShowConfig(false)}
        style={{with: '60%'}}
      >
        {
          settings && (
            <Form labelPosition='top'>
              <FormGroup label="存储目录">
                <FormItem status='normal'>
                  <Text value={settings.folder} disabled />
                </FormItem>
    
                <FormItem>
                  <Button
                    onClick={() => {
                      selectFolder(false).then(folder => {
                        if (folder) {
                          settings.folder = folder;
                          forceUpdate();
                        }
                      })
                    }}
                  >
                    选择
                  </Button>
                </FormItem>
              </FormGroup>
    
              <FormGroup label="WebDAV" elementStyle={{flexFlow: 'column'}}>
                <FormItem label="地址" status='normal'>
                  <Text
                    defaultValue={settings.webDav.url}
                    auto
                    onChange={e => {
                      settings.webDav.url = (e.target as any).value;
                    }}
                  />
                </FormItem>

                <FormItem label="用户名" status='normal'>
                  <Text
                    defaultValue={settings.webDav.user}
                    auto
                    onChange={e => {
                      settings.webDav.user = (e.target as any).value;
                    }}
                  />
                </FormItem>
    
                <FormItem label="密码" status='normal'>
                  <Text
                    defaultValue={settings.webDav.password}
                    auto
                    onChange={e => {
                      settings.webDav.password = (e.target as any).value;
                    }}
                    mode='password'
                  />
                </FormItem>
              </FormGroup>
            </Form>   
          )
        }
      </Modal>

      <Modal
        show={showConfirm}
        title='请确认重要信息更新'
        confirm={() => {
          props.onUpdateSettings(settings);
          setShowConfig(false);
          setShowConfirm(false);
        }}
        cancel={() => setShowConfirm(false)}
        titleStyle={{color: 'red'}}
        contentStyle={{color: 'red'}}
      >
        {
          confirmText.map(t => (
            <p key={t}>{t}</p>
          ))
        }
      </Modal>

      <Modal
        show={showAbout}
        confirm={() => setShowAbout(false)}
        showClose={false}
      >
        <div className={css.about}>
          <h1>Awaken</h1>
          <div className={css.aboutSlogan}>
            <p>作为演员的时候，我们不可忘却愤怒。</p>
            <p>作为观众的时候，我们不可忘却叹息。</p>
          </div>
          <p className={css.aboutLinks}>
            <a href="https://github.com/dtysky/Awaken" target='_blank'>项目主页</a>
            <a href="https://github.com/dtysky/Awaken/releases" target='_blank'>获取新版本</a>
          </p>

          <div className={css.aboutCopyright}>
            <p>Copyright © 2022</p>
            <p>戴天宇, Tianyu Dai (dtysky@outlook.com)</p>
            <p>本软件为开源软件，遵循协议</p>
            <a href="https://www.gnu.org/licenses/lgpl-3.0.html" target='_blank'>GNU Lesser General Public License (LGPL)</a>
          </div>
        </div>
      </Modal>
    </>
  )
}
