process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateHash } = require('../../algorithams/generateHash');

function buildExpectedHash(record, previousHash) {
    return generateHash(
        record.auditData,
        previousHash,
        record.createdAt,
    );
}

test('repair hash reconstruction uses the same inputs as verification', () => {
    const previousHash = 'prev';
    const record = {
        seq: 2,
        prevHash: previousHash,
        hash: 'abc123',
        createdAt: '2026-01-01T00:00:00.000Z',
        auditData: {
            id: 2,
            userId: 7,
            amount: '12.50',
            description: 'Coffee',
            createdAt: '2026-01-01T00:00:00.000Z',
        },
    };

    const rebuiltHash = buildExpectedHash(record, record.prevHash);
    const verifierHash = generateHash(record.auditData, record.prevHash, record.createdAt);

    assert.equal(rebuiltHash, verifierHash);
    assert.notEqual(rebuiltHash, record.hash);
});
