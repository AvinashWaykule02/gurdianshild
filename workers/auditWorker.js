// src/workers/audit.worker.js
//
// AUDIT WORKER — Processes BullMQ jobs sequentially (FIFO safe)
// Builds a cryptographic hash chain (SecurityLog) for every transaction.
// After chain creation, writes a backup record directly to S3.

const { Worker } = require("bullmq");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const connection = require("../config/redis");
const { generateHash } = require("../algorithams/generateHash");
const { writeTransactionBackup } = require("../services/s3BackupService");
const ledgerEventBus = require("../events/ledgerEventBus");
const { EVENTS } = require("../events/eventTypes");

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
| IDEMPOTENT: If SecurityLog already exists for this transactionId
| (e.g., on BullMQ retry after DynamoDB failure), we skip PostgreSQL
| creation and return the existing record. This makes retries safe.
|--------------------------------------------------------------------------
*/
async function processEvent(data) {
    const { outboxEventId, transactionId, payload } = data;

    console.log("[Worker] Processing event:");
    console.log("  Outbox ID:", outboxEventId);
    console.log("  Transaction ID:", transactionId);

    // ── IDEMPOTENCY CHECK ──────────────────────────────────────
    // If this job is being retried (e.g., S3 backup failed on first attempt),
    // the SecurityLog already exists in PostgreSQL. Don't create a duplicate.
    const existingLog = await prisma.securityLog.findFirst({
        where: { transactionId: transactionId },
    });

    if (existingLog) {
        console.log(
            `[Worker] SecurityLog already exists for txn ${transactionId} (seq #${existingLog.sequenceNumber}) — skipping PostgreSQL, retrying S3 only`
        );

        return {
            success: true,
            securityLogId: existingLog.id,
            sequenceNumber: existingLog.sequenceNumber,
            previousHash: existingLog.previousHash,
            currentHash: existingLog.currentHash,
        };
    }

    // ── FIRST ATTEMPT: Create SecurityLog + Update Chain State ─
    const now = new Date();

    // 1. Build deterministic snapshot (matches verify format)
    const auditData = buildAuditSnapshot(payload);

    // 2. Atomically: read chain state → create SecurityLog → update chain state
    const result = await prisma.$transaction(async (tx) => {
        // Fetch or create chain state
        const userIdNum = Number(payload.userId);
        let chainState = await tx.securityChainState.findUnique({
            where: { userId: userIdNum },
        });

        if (!chainState) {
            chainState = await tx.securityChainState.create({
                data: {
                    userId: userIdNum,
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
                userId: userIdNum,
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
            where: { userId: userIdNum },
            data: {
                latestSequence: nextSequence,
                latestHash: currentHash,
            },
        });

        console.log(
            `[Worker] SecurityLog #${nextSequence} created for txn ${transactionId}`
        );

        return {
            success: true,
            securityLogId: securityLog.id,
            sequenceNumber: nextSequence,
            previousHash: previousHash,
            currentHash: currentHash,
        };
    });

    return result;
}

/**
 * BullMQ Worker — ACID GUARANTEE
 *
 * Both PostgreSQL (SecurityLog) AND S3 backup must succeed.
 * If either fails, the job fails and BullMQ retries (3 attempts, exponential backoff).
 *
 * Idempotency:
 *   - processEvent() checks if SecurityLog already exists → skips if yes
 *   - S3 backup key is deterministic and idempotent by transaction
 *   - Outbox is only marked PROCESSED after BOTH writes succeed
 *
 * Flow:
 *   Attempt 1: PostgreSQL ✅ → S3 ❌ → Job FAILS → BullMQ retries
 *   Attempt 2: PostgreSQL SKIPPED (exists) → S3 ✅ → Outbox PROCESSED ✅
 */
const auditWorker = new Worker(
    "audit-queue",

    async (job) => {
        const data = job.data;

        console.log(`\n[Worker] Job started: ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts || 3})`);

        // ── STEP 1: PostgreSQL SecurityLog (idempotent) ─────────
        const result = await processEvent(data);

        // ── STEP 2: S3 Audit Backup (MANDATORY) ─────────────
        // If this throws, BullMQ retries the entire job.
        await writeTransactionBackup({
            userId: Number(data.payload.userId),
            transactionId: data.transactionId,
            seq: result.sequenceNumber,
            prevHash: result.previousHash,
            hash: result.currentHash,
            transactionData: data.payload,
            auditLog: {
                sequenceNumber: result.sequenceNumber,
                previousHash: result.previousHash,
                currentHash: result.currentHash,
                hmacSignature: data.payload.hmacSignature || null,
            },
            createdAt: data.payload.createdAt || new Date().toISOString(),
        });

        // ── STEP 3: Mark outbox PROCESSED (only after BOTH succeed) ─
        await prisma.auditOutbox.update({
            where: { id: data.outboxEventId },
            data: {
                status: "PROCESSED",
                processedAt: new Date(),
            },
        });

        ledgerEventBus.emitEvent(EVENTS.AUDIT_COMPLETE, {
            userId: Number(data.payload.userId),
            message: "Audit pipeline complete",
            meta: {
                transactionId: data.transactionId,
                sequenceNumber: result.sequenceNumber,
                outboxEventId: data.outboxEventId,
            },
        });

        console.log(`[Worker] Job completed: ${job.id} — PostgreSQL ✅ S3 ✅`);

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