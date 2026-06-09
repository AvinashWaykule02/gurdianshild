const prisma = require("../config/prisma");
const { generateHash } = require("./generateHash");

/*
|--------------------------------------------------------------------------
| BUILD SNAPSHOT (for integrity comparison)
|--------------------------------------------------------------------------
*/
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

/*
|--------------------------------------------------------------------------
| SNAPSHOT COMPARE
|--------------------------------------------------------------------------
*/
function snapshotsMatch(stored, live) {
  if (!stored || !live) return false;

  return (
    stored.id === live.id &&
    stored.userId === live.userId &&
    stored.amount === live.amount &&
    stored.description === live.description
  );
}

/*
|--------------------------------------------------------------------------
| VERIFY FULL HASH CHAIN (CORE FUNCTION)
|--------------------------------------------------------------------------
*/
async function verifyUserHashChain(userId) {
  const logs = await prisma.securityLog.findMany({
    orderBy: {
      sequenceNumber: "asc",
    },
    include: {
      transaction: true,
    },
  });

  const incidents = [];
  let userLogCount = 0;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    const expectedPreviousHash =
      i === 0 ? null : logs[i - 1].currentHash;

    const recalculatedHash = generateHash(
      log.auditData,
      expectedPreviousHash,
      log.createdAt
    );

    let compromised = false;
    let reason = "hash_mismatch";

    if (recalculatedHash !== log.currentHash) {
      compromised = true;
    } else {
      const liveTransaction = log.transaction;
      const liveSnapshot = buildTransactionSnapshot(liveTransaction);

      if (!snapshotsMatch(log.auditData, liveSnapshot)) {
        compromised = true;
        reason = "transaction_tampered";
      }
    }

    if (log.transaction.userId === Number(userId)) {
      userLogCount += 1;

      if (compromised) {
        const incident = await prisma.verificationRun.create({
          data: {
            status: "COMPROMISED",
            checkedLogs: i + 1,
            failedLogs: 1,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        });

        incidents.push({
          logId: log.id,
          transactionId: log.transactionId,
          reason,
          verificationId: incident.id,
        });
      }
    }
  }

  return {
    valid: incidents.length === 0,
    totalChecked: userLogCount,
    incidents,
  };
}

module.exports = { verifyUserHashChain };