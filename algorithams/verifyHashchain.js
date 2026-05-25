const SecurityLog = require('../models/securityLogs');
const SecurityIncident = require('../models/securityIncident');
const Transaction = require('../models/transaction');
const { generateHash } = require('./generateHash');

function buildTransactionSnapshot(transaction) {
  if (!transaction) return null;

  return {
    _id: transaction._id.toString(),
    userId: transaction.userId.toString(),
    amount: transaction.amount,
    type: transaction.type,
    description: transaction.description,
    status: transaction.status,
    createdAt: transaction.createdAt,
  };
}

function snapshotsMatch(storedSnapshot, liveSnapshot) {
  if (!storedSnapshot || !liveSnapshot) return false;
  return (
    storedSnapshot._id === liveSnapshot._id &&
    storedSnapshot.userId === liveSnapshot.userId &&
    storedSnapshot.amount === liveSnapshot.amount &&
    storedSnapshot.type === liveSnapshot.type &&
    storedSnapshot.description === liveSnapshot.description &&
    storedSnapshot.status === liveSnapshot.status &&
    new Date(storedSnapshot.createdAt).toISOString() === new Date(liveSnapshot.createdAt).toISOString()
  );
}

/**
 * Verifies the entire hash chain for a specific user.
 * - Fetches all SecurityLogs for the user in creation order
 * - Recalculates each hash using (transactionData, previousHash, timestamp)
 * - If stored hash !== recalculated hash → tampering detected
 * - If the live transaction record differs from the stored snapshot → tampering detected
 *   → creates a SecurityIncident document
 *
 * @param {string|ObjectId} userId
 * @returns {{ valid: boolean, totalChecked: number, incidents: Array }}
 */
async function verifyUserHashChain(userId) {
  const logs = await SecurityLog
    .find({ userId })
    .sort({ _id: 1 }); // oldest first → traverse chain forward

  const incidents = [];
  const transactionIds = logs.map((log) => log.transactionId);
  const transactions = await Transaction
    .find({ _id: { $in: transactionIds } })
    .lean();

  const transactionsById = new Map(
    transactions.map((transaction) => [transaction._id.toString(), transaction])
  );

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const expectedPreviousHash = i === 0 ? null : logs[i - 1].currentHash;
    const recalculated = generateHash(
      log.transactionData,
      expectedPreviousHash,
      log.timestamp
    );

    let compromised = false;
    let reason = 'hash_mismatch';

    if (recalculated !== log.currentHash) {
      compromised = true;
    } else {
      const liveTransaction = transactionsById.get(log.transactionId.toString());
      const liveSnapshot = buildTransactionSnapshot(liveTransaction);
      if (!snapshotsMatch(log.transactionData, liveSnapshot)) {
        compromised = true;
        reason = 'transaction_mismatch';
      }
    }

    if (compromised) {
      const incident = await SecurityIncident.create({
        affectedUser: userId,
        affectedTransaction: log.transactionId,
        expectedHash: log.currentHash,
        recalculatedHash: recalculated,
        detectedAt: new Date(),
        severity: 'CRITICAL',
        securityLogId: log._id,
      });

      incidents.push({
        logId: log._id,
        transactionId: log.transactionId,
        expectedHash: log.currentHash,
        recalculatedHash: recalculated,
        reason,
        incident: incident._id,
      });
    }
  }

  return {
    valid: incidents.length === 0,
    totalChecked: logs.length,
    incidents,
  };
}

module.exports = { verifyUserHashChain };