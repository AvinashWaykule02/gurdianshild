process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRole } = require('../../controllers/authController');

test('normalizeRole maps admin-style values to SUPER_ADMIN', () => {
    assert.equal(normalizeRole('ADMIN'), 'SUPER_ADMIN');
    assert.equal(normalizeRole('superadmin'), 'SUPER_ADMIN');
    assert.equal(normalizeRole('SUPER_ADMIN'), 'SUPER_ADMIN');
});

test('normalizeRole keeps regular users as USER', () => {
    assert.equal(normalizeRole('USER'), 'USER');
    assert.equal(normalizeRole('user'), 'USER');
    assert.equal(normalizeRole(undefined), 'USER');
});
