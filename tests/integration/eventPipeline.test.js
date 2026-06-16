process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ledgerEventBus = require('../../events/ledgerEventBus');
const { emit, EVENTS } = require('../../services/socketEventService');

test('emit forwards valid events through ledgerEventBus', async () => {
  const event = await new Promise((resolve) => {
    ledgerEventBus.once(EVENTS.TRANSACTION_CREATED, resolve);
    emit(EVENTS.TRANSACTION_CREATED, {
      userId: 1,
      message: 'Transaction created',
      meta: { transactionId: 101 },
    });
  });

  assert.equal(event.event, EVENTS.TRANSACTION_CREATED);
  assert.equal(event.userId, '1');
  assert.equal(event.meta.transactionId, 101);
});

test('unknown events are ignored', async () => {
  let called = false;
  ledgerEventBus.once('UNKNOWN_EVENT', () => {
    called = true;
  });

  await ledgerEventBus.emitEvent('UNKNOWN_EVENT', { userId: 1 });
  assert.equal(called, false);
});
