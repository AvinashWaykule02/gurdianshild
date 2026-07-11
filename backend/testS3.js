require("dotenv").config();

const { ListObjectsV2Command } = require("@aws-sdk/client-s3");
const s3Client = require("./config/s3");

async function test() {
    try {
        const result = await s3Client.send(
            new ListObjectsV2Command({
                Bucket: process.env.S3_BUCKET_NAME,
            })
        );

        console.log("✅ Bucket Access Successful");
        console.log(result);
    } catch (err) {
        console.error(err);
    }
}

test();