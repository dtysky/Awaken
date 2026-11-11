import {fs, path} from '@tauri-apps/api';

export interface IWebDAVLogEntry {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  error?: string;
}

let writes = Promise.resolve();
let lines: string[];
const filename = 'webdav.log';

// Keep the last 500 requests. Never pass request headers, credentials, file
// contents or notes to this logger. A logging failure must not break sync.
export function logWebDAV(entry: IWebDAVLogEntry): Promise<void> {
  writes = writes.catch(() => {}).then(async () => {
    const options = {dir: fs.BaseDirectory.Log};
    if (!lines) {
      await fs.createDir(await path.logDir(), {recursive: true});
      const exists = await fs.exists(filename, options) as unknown as boolean;
      const previous = exists ? await fs.readTextFile(filename, options) : '';
      lines = previous.split('\n').filter(Boolean).slice(-499);
    }
    lines.push(JSON.stringify({time: new Date().toISOString(), ...entry}));
    lines = lines.slice(-500);
    await fs.writeTextFile(filename, lines.join('\n') + '\n', options);
  }).catch(() => { console.warn('WebDAV 日志写入失败。'); });
  return writes;
}
