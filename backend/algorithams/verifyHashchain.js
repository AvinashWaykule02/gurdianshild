const prisma = require("../config/prisma");
const ledgerEventBus = require("../events/ledgerEventBus");
const { EVENTS } = require("../events/eventTypes");
const { generateHash } = require("./generateHash");
const { getLatestUserBackup } = require("../repositories/s3BackupRepository");

function buildTransactionSnapshot(transaction) {
  if (!transaction) return null;

  return {
    id: transaction.id,
    userId: transaction.userId,
    amount:
      typeof transaction.amount === "object" &&
      typeof transaction.amount.toString === "function"
        ? transaction.amount.toString()
        : transaction.amount,
    description: transaction.description,
    createdAt: transaction.createdAt,
  };
}

function snapshotsMatch(stored, live) {
  if (!stored || !live) return false;

  return (
    stored.id === live.id &&
    stored.userId === live.userId &&
    stored.amount === live.amount &&
    stored.description === live.description
  );
}

async function verifyUserHashChain(userId) {
  ledgerEventBus.emitEvent(EVENTS.VERIFICATION_STARTED, {
    userId,
    message: "Hash chain verification started",
  });

  const logs = await prisma.securityLog.findMany({
    where: { userId: Number(userId) },
    orderBy: { sequenceNumber: "asc" },
    include: { transaction: true },
  });

  const latestBackup = await getLatestUserBackup(userId);
  const backupMatch = latestBackup?.body ?? null;
  const lastSequenceNumber =
    logs.length > 0 ? logs[logs.length - 1].sequenceNumber : null;

  const incidents = [];
  let userLogCount = 0;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const previousHash = i === 0 ? null : logs[i - 1].currentHash;

    const recalculatedHash = generateHash(log.auditData, previousHash, log.createdAt);

    let compromised = false;
    let reason = "hash_mismatch";

    if (recalculatedHash !== log.currentHash) {
      compromised = true;
    } else {
      const liveSnapshot = buildTransactionSnapshot(log.transaction);

      if (!snapshotsMatch(log.auditData, liveSnapshot)) {
        compromised = true;
        reason = "transaction_tampered";
      }

      // Only flag a missing backup against the most recent log entry.
      // A null/empty backup for older, already-superseded log entries is
      // expected (only the latest backup is fetched) and should not mark
      // the entire historical chain as compromised.
      if (
        !backupMatch &&
        !compromised &&
        log.sequenceNumber === lastSequenceNumber
      ) {
        compromised = true;
        reason = "missing_s3_backup";
      }

      if (backupMatch && log.sequenceNumber === backupMatch.seq) {
        if (
          backupMatch.hash !== log.currentHash ||
          backupMatch.prevHash !== log.previousHash ||
          backupMatch.transactionId !== log.transactionId
        ) {
          compromised = true;
          reason = "s3_backup_mismatch";
        }
      }
    }

    userLogCount += 1;

    if (compromised) {
      const verificationRun = await prisma.verificationRun.create({
        data: {
          status: "COMPROMISED",
          userId: Number(userId),
          checkedLogs: i + 1,
          failedLogs: 1,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });

      const incident = await prisma.incident.create({
        data: {
          userId: Number(userId),
          corruptionStartSeq: log.sequenceNumber,
          status: "OPEN",
          severity: "HIGH",
          description: `Tampering detected during verification: ${reason}`,
          verificationRunId: verificationRun.id,
        },
      });

      await prisma.ledgerState.upsert({
        where: { userId: Number(userId) },
        update: {
          status: "LOCKED",
          lockedAt: new Date(),
          lockedReason: `Tampering detected: ${reason}`,
          incidentId: incident.id,
        },
        create: {
          userId: Number(userId),
          status: "LOCKED",
          lockedAt: new Date(),
          lockedReason: `Tampering detected: ${reason}`,
          incidentId: incident.id,
        },
      });

      ledgerEventBus.emitEvent(EVENTS.TAMPER_DETECTED, {
        userId,
        severity: "CRITICAL",
        message: `Tampering detected: ${reason}`,
        meta: { corruptionStartSeq: log.sequenceNumber, reason },
      });

      ledgerEventBus.emitEvent(EVENTS.LEDGER_LOCKED, {
        userId,
        severity: "HIGH",
        message: "Ledger locked due to tampering",
        meta: { incidentId: incident.id },
      });

      ledgerEventBus.emitEvent(EVENTS.INCIDENT_CREATED, {
        userId,
        severity: "HIGH",
        message: `Incident created: ${reason}`,
        meta: { incidentId: incident.id, reason },
      });

      incidents.push({
        incidentId: incident.id,
        logId: log.id,
        transactionId: log.transactionId,
        reason,
        verificationId: verificationRun.id,
      });
    }
  }

  if (incidents.length === 0) {
    ledgerEventBus.emitEvent(EVENTS.VERIFICATION_OK, {
      userId,
      message: "Verification passed",
      meta: { totalChecked: userLogCount },
    });
  }

  return {
    valid: incidents.length === 0,
    totalChecked: userLogCount,
    incidents,
    latestBackupKey: latestBackup?.key ?? null,
  };
}

module.exports = {
  verifyUserHashChain,
  buildTransactionSnapshot,
  snapshotsMatch,
};