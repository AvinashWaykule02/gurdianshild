process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateHash } = require('../../algorithams/generateHash');

test('generateHash is deterministic with same inputs', () => {
  const tx = { id: 1, userId: 2, amount: '100.00', description: 'A' };
  const ts = '2026-01-01T00:00:00.000Z';
  const h1 = generateHash(tx, null, ts);
  const h2 = generateHash(tx, null, ts);
  assert.equal(h1, h2);
  assert.equal(h1.length, 64);
});

test('generateHash changes when chain link changes', () => {
  const tx = { id: 1, userId: 2, amount: '100.00', description: 'A' };
  const ts = '2026-01-01T00:00:00.000Z';
  const genesis = generateHash(tx, null, ts);
  const linked = generateHash(tx, genesis, ts);
  assert.notEqual(genesis, linked);
});
