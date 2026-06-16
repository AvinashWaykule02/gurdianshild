const { buildTransactionBackupKey, uploadTransactionBackup } = require("../repositories/s3BackupRepository");

function buildBackupPayload({ userId, transactionId, seq, prevHash, hash, transactionData, auditLog, createdAt }) {
    return {
        userId,
        transactionId,
        seq,
        prevHash,
        hash,
        transactionData,
        auditLog,
        createdAt,
    };
}

async function writeTransactionBackup({ userId, transactionId, seq, prevHash, hash, transactionData, auditLog, createdAt }) {
    const s3Key = buildTransactionBackupKey(userId, seq, transactionId);
    const backupPayload = buildBackupPayload({
        userId,
        transactionId,
        seq,
        prevHash,
        hash,
        transactionData,
        auditLog,
        createdAt,
    });

    await uploadTransactionBackup(s3Key, backupPayload);

    return {
        key: s3Key,
        payload: backupPayload,
    };
}

module.exports = {
    writeTransactionBackup,
};
