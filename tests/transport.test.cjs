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
    if (platform === 'desktop') assert.equal(bridge.logs[0].status, 0);
  });
  test(`${platform} preserves the server error detail and body with a readable HTTP reason`, async () => {
    const xml = '<d:error xmlns:d="DAV:" xmlns:s="http://example.invalid/"><s:message>the nustore path is not valid /书名:副标题.epub</s:message></d:error>';
    const bridge = transport(platform, async () => new Response(xml, {status: 400}));
    const response = await bridge.request({url: 'https://example.invalid/书名%3A副标题.epub', method: 'PUT', data: new ArrayBuffer(5)});
    assert.equal(response.data, xml);
    assert.match(response.statusText, /Bad Request: the nustore path is not valid/);
    if (platform === 'desktop') assert.equal(bridge.logs[0].error, response.statusText);
  });
}

test('desktop logs only request diagnostics and strips URL credentials and query tokens', async () => {
  const bridge = transport('desktop', async () => new Response('', {status: 201}));
  await bridge.request({url: 'https://user:secret@example.invalid/书名.epub?token=private#fragment', method: 'PUT',
    headers: {Authorization: 'Basic private-credentials'}, data: Uint8Array.from([1, 2, 3]).buffer});
  const entry = bridge.logs[0];
  assert.equal(entry.url, 'https://example.invalid/书名.epub');
  assert.equal(entry.status, 201);
  assert.ok(entry.durationMs >= 0);
  assert.doesNotMatch(JSON.stringify(entry), /secret|private|Authorization|fragment|body/);
  assert.equal(bridge.requests[0].timeout, 120);
});
