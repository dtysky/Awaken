const {load} = require('./helpers.cjs');
const common = load('src/backend/common.ts');
const {DAV_PREFIX} = common;

// Execute the production XHR bridge. The native boundary returns the same
// serialized text / byte-array shapes as Tauri, using real HTTP in integration tests.
function transport(platform = 'desktop', fetcher = fetch) {
  let hooks;
  const requests = [];
  const logs = [];
  const deps = {'ajax-hook': {proxy(value) {hooks = value;}}, '../../interfaces': {},
    '../common': common, './log': {async logWebDAV(entry) {logs.push(entry);}}};
  if (platform === 'desktop') {
    deps['@tauri-apps/api'] = {
      fs: {BaseDirectory: {App: 1, Log: 2}}, path: {}, dialog: {}, tauri: {},
      http: {
        ResponseType: {Text: 2, Binary: 3},
        Body: {text: payload => ({payload}), bytes: value => ({payload: new Uint8Array(value)})},
        async fetch(url, options) {
          requests.push({url, ...options});
          const res = await fetcher(url, {...options, body: options.body?.payload});
          return {status: res.status, headers: Object.fromEntries(res.headers.entries()),
            data: options.responseType === 3 ? [...new Uint8Array(await res.arrayBuffer())] : await res.text()};
        }
      }
    };
  } else {deps['./utils'] = {};}
  load(`src/backend/${platform === 'desktop' ? 'desktop' : 'native'}/index.ts`, deps, {
    document: {addEventListener() {}},
    window: {addEventListener() {}, ...(platform === 'desktop' ? {} : {Awaken: {getPlatform: () => 'IOS'}})},
    fetch: (url, options) => fetcher(new URL(url).searchParams.get('url'), options)
  });
  const request = options => new Promise((resolve, reject) => {
    const config = {url: options.url.startsWith(DAV_PREFIX) ? options.url : DAV_PREFIX + options.url,
      method: options.method, body: options.data, headers: options.headers || {},
      xhr: {responseType: options.responseType || ''}};
    hooks.onRequest(config, {
      next() {reject(new Error('WebDAV bridge was bypassed'));},
      resolve(res) {resolve({status: res.status, statusText: res.statusText, headers: res.headers, data: res.response});},
      reject(error) {reject(Object.assign(new Error('Bridge network error'), {type: error.type}));}
    });
  });
  return {request, requests, logs, DAV_PREFIX};
}
module.exports = {transport};
