process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../../app');

test('GET /health returns healthy response', async () => {
  const server = app.listen(0);

  try {
    const port = server.address().port;
    const body = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port, path: '/health' }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      }).on('error', reject);
    });

    const parsed = JSON.parse(body.data);
    assert.equal(body.statusCode, 200);
    assert.equal(parsed.success, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
