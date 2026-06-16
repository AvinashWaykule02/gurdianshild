process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildTransactionSnapshot, snapshotsMatch } = require('../../algorithams/verifyHashchain');

test('buildTransactionSnapshot normalizes amount', () => {
  const tx = {
    id: 5,
    userId: 9,
    amount: { toString: () => '50.00' },
    description: 'Coffee',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
  };

  const snap = buildTransactionSnapshot(tx);
  assert.equal(snap.amount, '50.00');
  assert.equal(snap.id, 5);
  assert.equal(snap.userId, 9);
});

test('snapshotsMatch detects match and mismatch', () => {
  const base = { id: 1, userId: 1, amount: '10.00', description: 'x' };
  assert.equal(snapshotsMatch(base, { ...base }), true);
  assert.equal(snapshotsMatch(base, { ...base, amount: '999.00' }), false);
  assert.equal(snapshotsMatch(null, base), false);
});
