// config/s3.js
//
// AWS S3 Client — Singleton
//
// Used by the S3 backup pipeline to write immutable transaction audit records.

const { S3Client } = require("@aws-sdk/client-s3");

/*
|--------------------------------------------------------------------------
| CLIENT CONFIGURATION
|--------------------------------------------------------------------------
| Reuses the same AWS_REGION + credentials as DynamoDB.
| Set S3_ENDPOINT for local development (MinIO / LocalStack).
|--------------------------------------------------------------------------
*/
const clientConfig = {
    region: process.env.AWS_REGION || "ap-south-1",
};

// Allow custom endpoint for local development (MinIO / LocalStack)
if (process.env.S3_ENDPOINT) {
    clientConfig.endpoint = process.env.S3_ENDPOINT;
    clientConfig.forcePathStyle = true; // Required for MinIO/LocalStack
}

// Explicit credentials (falls back to instance profile if not set)
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
}

const s3Client = new S3Client(clientConfig);

module.exports = s3Client;
