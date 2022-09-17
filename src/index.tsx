/**
 * @File   : index.ts
 * @Author : dtysky (dtysky@outlook.com)
 * @Link   : dtysky.moe
 * @Date   : 2022/9/14 23:56:19
 */
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import App from './frontend/App';

const container = document.getElementById('container');
const root = createRoot(container);
root.render(<App />);
