process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EVENTS, EVENT_LIST, isValidEvent } = require('../../events/eventTypes');

test('event catalog contains only required events', () => {
  assert.equal(EVENT_LIST.length, 11);
  assert.deepEqual(EVENT_LIST, [
    EVENTS.TRANSACTION_CREATED,
    EVENTS.AUDIT_COMPLETE,
    EVENTS.VERIFICATION_STARTED,
    EVENTS.VERIFICATION_OK,
    EVENTS.TAMPER_DETECTED,
    EVENTS.INCIDENT_CREATED,
    EVENTS.INCIDENT_UPDATED,
    EVENTS.LEDGER_LOCKED,
    EVENTS.LEDGER_UNLOCKED,
    EVENTS.REPAIR_STARTED,
    EVENTS.REPAIR_COMPLETED,
  ]);
});

test('isValidEvent validates allowed events only', () => {
  assert.equal(isValidEvent(EVENTS.TAMPER_DETECTED), true);
  assert.equal(isValidEvent('S3_UPLOAD_SUCCESS'), false);
});
