// src/workers/audit.worker.js
//
// AUDIT WORKER — Processes BullMQ jobs sequentially (FIFO safe)
// Builds a cryptographic hash chain (SecurityLog) for every transaction.

const { Worker } = require("bullmq");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const connection = require("../config/redis");
const { generateHash } = require("../algorithams/generateHash");

/*
|--------------------------------------------------------------------------
| BUILD AUDIT SNAPSHOT
|--------------------------------------------------------------------------
| Shape MUST match verifyHashchain.js → buildTransactionSnapshot()
| so the live-data comparison works correctly.
|--------------------------------------------------------------------------
*/
function buildAuditSnapshot(payload) {
    return {
        id: payload.id,
        userId: payload.userId,
        amount:
            typeof payload.amount === "object" &&
            typeof payload.amount.toString === "function"
                ? payload.amount.toString()
                : String(payload.amount),
        description: payload.description,
        createdAt: payload.createdAt,
    };
}

/*
|--------------------------------------------------------------------------
| GENERATE HMAC SIGNATURE
|--------------------------------------------------------------------------
*/
function generateHmac(data, secret) {
    return crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(data))
        .digest("hex");
}

/*
|--------------------------------------------------------------------------
| CORE AUDIT PROCESSING — Hash Chain + SecurityLog creation
|--------------------------------------------------------------------------
*/
async function processEvent(data) {
    const { outboxEventId, transactionId, payload } = data;

    console.log("[Worker] Processing event:");
    console.log("  Outbox ID:", outboxEventId);
    console.log("  Transaction ID:", transactionId);

    const now = new Date();

    // 1. Build deterministic snapshot (matches verify format)
    const auditData = buildAuditSnapshot(payload);

    // 2. Atomically: read chain state → create SecurityLog → update chain state
    const result = await prisma.$transaction(async (tx) => {
        // Fetch or create chain state
        let chainState = await tx.securityChainState.findUnique({
            where: { id: 1 },
        });

        if (!chainState) {
            chainState = await tx.securityChainState.create({
                data: {
                    id: 1,
                    latestSequence: 0,
                    latestHash: "GENESIS",
                },
            });
        }

        const previousHash =
            chainState.latestSequence === 0 ? null : chainState.latestHash;
        const nextSequence = chainState.latestSequence + 1;

        // 3. Generate hash (chained to previous)
        const currentHash = generateHash(auditData, previousHash, now);

        // 4. Generate HMAC signature
        const hmacSecret = process.env.JWT_SECRET || "guardian-shield-secret";
        const hmacSignature = generateHmac(
            { auditData, previousHash, currentHash, sequenceNumber: nextSequence },
            hmacSecret
        );

        // 5. Create SecurityLog entry
        const securityLog = await tx.securityLog.create({
            data: {
                sequenceNumber: nextSequence,
                transactionId: transactionId,
                previousHash: previousHash,
                currentHash: currentHash,
                hmacSignature: hmacSignature,
                auditData: auditData,
                createdAt: now,
            },
        });

        // 6. Update chain state
        await tx.securityChainState.update({
            where: { id: 1 },
            data: {
                latestSequence: nextSequence,
                latestHash: currentHash,
            },
        });

        console.log(
            `[Worker] SecurityLog #${nextSequence} created for txn ${transactionId}`
        );

        return { success: true, securityLogId: securityLog.id };
    });

    return result;
}

/**
 * BullMQ Worker
 */
const auditWorker = new Worker(
    "audit-queue",

    async (job) => {
        const data = job.data;

        console.log(`\n[Worker] Job started: ${job.id}`);

        // 1. Process event — create hash chain entry
        const result = await processEvent(data);

        // 2. Mark as processed in DB (source of truth)
        await prisma.auditOutbox.update({
            where: { id: data.outboxEventId },
            data: {
                status: "PROCESSED",
                processedAt: new Date(),
            },
        });

        console.log(`[Worker] Job completed: ${job.id}`);

        return result;
    },

    {
        connection,

        // IMPORTANT: ensures strict FIFO processing
        concurrency: 1,
    }
);

/**
 * Success event
 */
auditWorker.on("completed", (job) => {
    console.log(`[Worker] Completed: ${job.id}`);
});

/**
 * Failure handling
 */
auditWorker.on("failed", async (job, err) => {
    console.error(`[Worker] Failed: ${job.id} → ${err.message}`);

    const { outboxEventId } = job.data;

    // Mark as FAILED after retries
    const attemptsLeft =
        job.opts.attempts - (job.attemptsMade + 1);

    if (attemptsLeft <= 0) {
        await prisma.auditOutbox.update({
            where: { id: outboxEventId },
            data: { status: "FAILED" },
        });

        console.log(
            `[Worker] Permanently failed: ${outboxEventId}`
        );
    }
});

/**
 * Graceful shutdown
 */
async function shutdown() {
    console.log("[Worker] Shutting down...");
    await auditWorker.close();
    console.log("[Worker] Stopped");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = auditWorker;