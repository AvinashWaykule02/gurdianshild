const {
    PutObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const s3Client = require("../config/s3");

// ----------------------------
// ENV VALIDATION (IMPORTANT)
// ----------------------------
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const S3_PREFIX = process.env.S3_PREFIX || "guardianshield/users";

if (!S3_BUCKET) {
    throw new Error("❌ S3_BUCKET_NAME is missing in environment variables");
}

// ----------------------------
// KEY GENERATION
// ----------------------------
function buildTransactionBackupKey(userId, sequenceNumber, transactionId) {
    const seqPadded = String(sequenceNumber).padStart(10, "0");
    return `${S3_PREFIX}/${userId}/transactions/${seqPadded}-${transactionId}.json`;
}

// ----------------------------
// UPLOAD OBJECT
// ----------------------------
async function uploadTransactionBackup(s3Key, payload) {
    const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: JSON.stringify(payload, null, 2),
        ContentType: "application/json",
        ServerSideEncryption:
            process.env.S3_SERVER_SIDE_ENCRYPTION || "AES256",
        Metadata: {
            "user-id": String(payload.userId || ""),
            "transaction-id": String(payload.transactionId || ""),
            "sequence-number": String(payload.seq || ""),
            "backup-type": "transaction-audit-backup",
        },
    });

    await s3Client.send(command);
    return s3Key;
}

// ----------------------------
// PARSE SEQUENCE FROM KEY
// ----------------------------
function parseSequenceFromKey(key) {
    try {
        const fileName = key.split("/").pop();
        const seqPart = fileName.split("-")[0];
        return Number(seqPart) || 0;
    } catch (err) {
        return 0;
    }
}

// ----------------------------
// LIST USER BACKUPS
// Fully paginates through S3 (ListObjectsV2 caps at 1000 keys per page,
// so a user with more backups than that would otherwise be silently
// truncated). Keeps requesting continuation pages until IsTruncated is
// false or the maxKeys budget is reached.
// ----------------------------
async function listUserBackups(userId, maxKeys = 1000) {
    const prefix = `${S3_PREFIX}/${userId}/transactions/`;

    let files = [];
    let continuationToken = undefined;

    do {
        const command = new ListObjectsV2Command({
            Bucket: S3_BUCKET,
            Prefix: prefix,
            MaxKeys: 1000,
            ContinuationToken: continuationToken,
        });

        const result = await s3Client.send(command);

        const page = (result.Contents || [])
            .filter((obj) => obj.Key)
            .map((obj) => ({
                Key: obj.Key,
                LastModified: obj.LastModified,
            }));

        files = files.concat(page);

        continuationToken = result.IsTruncated
            ? result.NextContinuationToken
            : undefined;
    } while (continuationToken && files.length < maxKeys);

    if (maxKeys && files.length > maxKeys) {
        files = files.slice(0, maxKeys);
    }

    files.sort((a, b) => parseSequenceFromKey(a.Key) - parseSequenceFromKey(b.Key));

    return files;
}

// ----------------------------
// GET SINGLE OBJECT
// ----------------------------
async function getObjectBody(key) {
    const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
    });

    const response = await s3Client.send(command);
    if (!response.Body) return null;

    const chunks = [];
    for await (const chunk of response.Body) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString("utf-8");
}

// ----------------------------
// GET LATEST BACKUP
// ----------------------------
async function getLatestUserBackup(userId) {
    const backups = await listUserBackups(userId);
    if (!backups.length) {
        return null;
    }

    const latest = backups[backups.length - 1];
    const body = await getObjectBody(latest.Key);

    let parsed = null;
    try {
        parsed = body ? JSON.parse(body) : null;
    } catch (err) {
        parsed = {
            error: "Invalid JSON in S3 object",
            raw: body,
        };
    }

    return {
        key: latest.Key,
        body: parsed,
    };
}

// ----------------------------
// EXPORTS
// ----------------------------
module.exports = {
    buildTransactionBackupKey,
    uploadTransactionBackup,
    listUserBackups,
    getObjectBody,
    getLatestUserBackup,
};