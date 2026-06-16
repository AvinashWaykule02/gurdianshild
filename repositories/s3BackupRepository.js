const { PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const s3Client = require("../config/s3");

const S3_BUCKET = process.env.S3_BUCKET_NAME || "guardianshield";
const S3_PREFIX = process.env.S3_PREFIX || "guardianshield/users";

function buildTransactionBackupKey(userId, sequenceNumber, transactionId) {
    const seqPadded = String(sequenceNumber).padStart(10, "0");
    return `${S3_PREFIX}/${userId}/transactions/${seqPadded}-${transactionId}.json`;
}

async function uploadTransactionBackup(s3Key, payload) {
    const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: JSON.stringify(payload, null, 2),
        ContentType: "application/json",
        ServerSideEncryption: process.env.S3_SERVER_SIDE_ENCRYPTION || "AES256",
        Metadata: {
            "user-id": String(payload.userId),
            "transaction-id": String(payload.transactionId),
            "sequence-number": String(payload.seq),
            "backup-type": "transaction-audit-backup",
        },
    });

    await s3Client.send(command);
    return s3Key;
}

function parseSequenceFromKey(key) {
    const parts = key.split("/");
    const fileName = parts[parts.length - 1] || "";
    const [seqPart] = fileName.split("-");
    return Number(seqPart) || 0;
}

async function listUserBackups(userId, maxKeys = 1000) {
    const prefix = `${S3_PREFIX}/${userId}/transactions/`;
    const command = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        MaxKeys: maxKeys,
    });

    const result = await s3Client.send(command);
    return (result.Contents || [])
        .map((obj) => ({ Key: obj.Key, LastModified: obj.LastModified }))
        .filter((item) => item.Key)
        .sort((a, b) => {
            const aSeq = parseSequenceFromKey(a.Key);
            const bSeq = parseSequenceFromKey(b.Key);
            return aSeq - bSeq;
        });
}

async function getObjectBody(key) {
    const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
    });

    const response = await s3Client.send(command);
    const stream = response.Body;

    if (!stream) {
        return null;
    }

    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    }

    return chunks.join("");
}

async function getLatestUserBackup(userId) {
    const backups = await listUserBackups(userId, 1000);
    if (!backups.length) {
        return null;
    }

    const latest = backups[backups.length - 1];
    const body = await getObjectBody(latest.Key);

    return {
        key: latest.Key,
        body: body ? JSON.parse(body) : null,
    };
}

module.exports = {
    buildTransactionBackupKey,
    uploadTransactionBackup,
    listUserBackups,
    getLatestUserBackup,
};
