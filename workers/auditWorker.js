// AUDIT WORKER
//
// Processes audit events from BullMQ queue.
// Responsibility:
// 1. Build cryptographic hash chain (SecurityLog)
// 2. Store immutable audit log in PostgreSQL
// 3. Create S3 backup
// 4. Mark outbox as PROCESSED
// 5. Emit audit completion event
//
// NOTE:
// concurrency: 1 ensures sequential processing inside this process.
// For multi-instance safety, ensure only one worker instance per user partition.

const { Worker } = require("bullmq");
const crypto = require("crypto");

const prisma = require("../config/prisma");
const connection = require("../config/redis");

const { generateHash } = require("../algorithams/generateHash");
const { writeTransactionBackup } = require("../services/s3BackupService");

const ledgerEventBus = require("../events/ledgerEventBus");
const { EVENTS } = require("../events/eventTypes");

// -----------------------------------------------------------------------------
// BUILD AUDIT SNAPSHOT (must match verification logic exactly)
// -----------------------------------------------------------------------------

function buildAuditSnapshot(payload) {
  return {
    id: payload.id,
    userId: payload.userId,
    amount:
      typeof payload.amount === "object"
        ? payload.amount.toString()
        : String(payload.amount),

    description: payload.description,
    createdAt: payload.createdAt,
  };
}

// -----------------------------------------------------------------------------
// HMAC SIGNATURE (extra integrity layer)
// -----------------------------------------------------------------------------

function generateHmac(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(data))
    .digest("hex");
}

// -----------------------------------------------------------------------------
// CORE PROCESSING (Idempotent + Chain Builder)
// -----------------------------------------------------------------------------

async function processEvent(data) {
  const { transactionId, payload, outboxEventId } = data;

  console.log("[Worker] Processing transaction:", transactionId);

  // ---------------------------------------------------------------------------
  // IDEMPOTENCY CHECK
  // ---------------------------------------------------------------------------
  const existingLog = await prisma.securityLog.findFirst({
    where: { transactionId },
  });

  if (existingLog) {
    console.log(
      `[Worker] Existing SecurityLog found for txn ${transactionId}, skipping DB write`
    );

    return {
      success: true,
      securityLogId: existingLog.id,
      sequenceNumber: existingLog.sequenceNumber,
      previousHash: existingLog.previousHash,
      currentHash: existingLog.currentHash,
      hmacSignature: existingLog.hmacSignature,
    };
  }

  const now = new Date();
  const auditData = buildAuditSnapshot(payload);

  // ---------------------------------------------------------------------------
  // TRANSACTION: CREATE SECURITY LOG + UPDATE CHAIN STATE
  // ---------------------------------------------------------------------------
  return prisma.$transaction(async (tx) => {
    const userId = Number(payload.userId);

    // Fetch or initialize chain state
    let chainState = await tx.securityChainState.findUnique({
      where: { userId },
    });

    if (!chainState) {
      chainState = await tx.securityChainState.create({
        data: {
          userId,
          latestSequence: 0,
          latestHash: "GENESIS",
        },
      });
    }

    const previousHash =
      chainState.latestSequence === 0 ? null : chainState.latestHash;

    const nextSequence = chainState.latestSequence + 1;

    // Generate cryptographic hash
    const currentHash = generateHash(auditData, previousHash, now);

    // Generate HMAC signature (tamper detection layer)
    const secret = process.env.JWT_SECRET || "guardian-shield-secret";

    const hmacSignature = generateHmac(
      {
        auditData,
        previousHash,
        currentHash,
        sequenceNumber: nextSequence,
      },
      secret
    );

    // Create immutable audit log
    const securityLog = await tx.securityLog.create({
      data: {
        userId,
        transactionId,
        sequenceNumber: nextSequence,
        previousHash,
        currentHash,
        hmacSignature,
        auditData,
        createdAt: now,
      },
    });

    // Update chain head
    await tx.securityChainState.update({
      where: { userId },
      data: {
        latestSequence: nextSequence,
        latestHash: currentHash,
      },
    });

    return {
      success: true,
      securityLogId: securityLog.id,
      sequenceNumber: nextSequence,
      previousHash,
      currentHash,
      hmacSignature,
    };
  });
}

// -----------------------------------------------------------------------------
// BULLMQ WORKER
// -----------------------------------------------------------------------------

const auditWorker = new Worker(
  "audit-queue",

  async (job) => {
    const data = job.data;

    console.log(
      `[Worker] Job ${job.id} started (attempt ${job.attemptsMade + 1})`
    );

    // STEP 1: PostgreSQL audit chain
    const result = await processEvent(data);

    // STEP 2: S3 backup (critical for durability)
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
        hmacSignature: result.hmacSignature,
      },
      createdAt: data.payload.createdAt || new Date().toISOString(),
    });

    // STEP 3: Mark outbox as processed
    await prisma.auditOutbox.update({
      where: { id: data.outboxEventId },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    // STEP 4: Emit event (non-critical)
    try {
      ledgerEventBus.emitEvent(EVENTS.AUDIT_COMPLETE, {
        userId: Number(data.payload.userId),
        transactionId: data.transactionId,
        sequenceNumber: result.sequenceNumber,
        outboxEventId: data.outboxEventId,
      });
    } catch (err) {
      console.error("[Worker] Event emit failed:", err.message);
    }

    console.log(`[Worker] Job completed: ${job.id}`);

    return result;
  },
  {
    connection,
    concurrency: 1,
  }
);

// -----------------------------------------------------------------------------
// EVENTS
// -----------------------------------------------------------------------------

auditWorker.on("completed", (job) => {
  console.log(`[Worker] Completed: ${job.id}`);
});

auditWorker.on("failed", async (job, err) => {
  console.error(`[Worker] Failed: ${job.id} → ${err.message}`);

  const { outboxEventId } = job.data;
  const attemptsLeft =
    (job.opts.attempts || 3) - (job.attemptsMade + 1);

  if (attemptsLeft <= 0) {
    await prisma.auditOutbox.update({
      where: { id: outboxEventId },
      data: { status: "FAILED" },
    });

    console.log(`[Worker] Permanently failed: ${outboxEventId}`);
  }
});

// -----------------------------------------------------------------------------
// GRACEFUL SHUTDOWN
// -----------------------------------------------------------------------------

async function shutdown() {
  console.log("[Worker] Shutting down...");
  await auditWorker.close();
  console.log("[Worker] Stopped");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = auditWorker;