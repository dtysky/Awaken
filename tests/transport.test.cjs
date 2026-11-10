const {test} = require('node:test');
const assert = require('node:assert/strict');
const {transport} = require('./transport.cjs');

for (const platform of ['desktop', 'ios']) {
  test(`${platform} keeps PROPFIND XML as text and downloads exact binary bytes`, async () => {
    const xml = '<d:multistatus xmlns:d="DAV:"><d:response/></d:multistatus>';
    const bytes = Uint8Array.from([0, 128, 255, 80, 75]);
    const bridge = transport(platform, async (url, options) =>
      new Response(options.method === 'PROPFIND' ? xml : bytes, {status: options.method === 'PROPFIND' ? 207 : 200,
        headers: {etag: '"revision-1"'}}));
    for (const filename of ['cover.png', 'book.epub']) {
      const res = await bridge.request({url: 'https://example.invalid/' + filename, method: 'PROPFIND', responseType: 'text'});
      assert.equal(res.data, xml);
      assert.equal(res.headers.etag, '"revision-1"');
    }
    // An extensionless binary GET must also preserve the requested type.
    const res = await bridge.request({url: 'https://example.invalid/download', method: 'GET', responseType: 'arraybuffer'});
    assert.ok(res.data instanceof ArrayBuffer);
    assert.deepEqual(new Uint8Array(res.data), bytes);
  });
  test(`${platform} reports transport failures as XHR errors`, async () => {
    const bridge = transport(platform, async () => {throw new Error('Disconnected');});
    await assert.rejects(bridge.request({url: 'https://example.invalid/books.json', method: 'GET', responseType: 'text'}),
      error => error.type === 'error');
  });
}
