const crypto = require("crypto");
const prisma = require("../config/prisma");
const { emit, EVENTS } = require("./socketEventService");
const incidentRepository = require("../repositories/incidentRepository");
const { listUserBackups, getObjectBody } = require("../repositories/s3BackupRepository");

function generateHmac(data, secret) {
    return crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(data))
        .digest("hex");
}

async function fetchTransactionHistoryFromS3(userId) {
    const backups = await listUserBackups(userId, 1000);
    const history = [];

    for (const backup of backups) {
        const body = await getObjectBody(backup.Key);
        if (!body) continue;

        try {
            history.push(JSON.parse(body));
        } catch (err) {
            console.warn(`[RepairService] Failed to parse backup ${backup.Key}: ${err.message}`);
        }
    }

    return history.sort((a, b) => a.seq - b.seq);
}

async function lockLedgerForRepair(incidentId) {
    const incident = await incidentRepository.findIncidentById(incidentId);
    if (incident) {
        await prisma.ledgerState.updateMany({
            where: { userId: incident.userId },
            data: { status: "UNDER_REPAIR" },
        });
    }
    return incidentRepository.updateIncidentStatus(incidentId, "REPAIRING");
}

async function unlockLedgerAfterRepair(incidentId) {
    const incident = await incidentRepository.findIncidentById(incidentId);
    if (incident) {
        await prisma.ledgerState.updateMany({
            where: { userId: incident.userId },
            data: { status: "ACTIVE", lockedAt: null, lockedReason: null, incidentId: null },
        });
    }
    return incidentRepository.updateIncidentStatus(incidentId, "RESOLVED");
}

async function repairUserLedgerFromS3(incidentId) {
    const incident = await incidentRepository.findIncidentById(incidentId);
    if (!incident) {
        throw new Error(`Incident ${incidentId} not found`);
    }

    const userId = incident.userId;
    const history = await fetchTransactionHistoryFromS3(userId);

    if (!history.length) {
        throw new Error(`No S3 backup history found for user ${userId}`);
    }

    const corruptionStartSeq = incident.corruptionStartSeq;
    const startIndex = history.findIndex((record) => record.seq >= corruptionStartSeq);

    if (startIndex === -1) {
        throw new Error(`Corruption start sequence ${corruptionStartSeq} not found in S3 history`);
    }

    emit(EVENTS.LEDGER_LOCKED, {
        userId,
        severity: "WARN",
        message: "Ledger locked for repair",
        meta: { incidentId },
    });

    await lockLedgerForRepair(incidentId);

    const repairedResult = await prisma.$transaction(async (tx) => {
        const hmacSecret = process.env.JWT_SECRET || "guardian-shield-secret";
        let restoredCount = 0;

        for (let i = startIndex; i < history.length; i++) {
            const record = history[i];

            await tx.transaction.updateMany({
                where: { id: Number(record.transactionId) },
                data: {
                    userId: Number(record.userId),
                    amount: record.transactionData.amount,
                    description: record.transactionData.description,
                    createdAt: new Date(record.createdAt),
                },
            });

            const auditData = record.auditLog?.auditData || {
                id: record.transactionData.id,
                userId: record.transactionData.userId,
                amount: String(record.transactionData.amount),
                description: record.transactionData.description,
                createdAt: record.transactionData.createdAt,
            };

            const hmacSignature = generateHmac(
                { auditData, previousHash: record.prevHash, currentHash: record.hash, sequenceNumber: record.seq },
                hmacSecret
            );

            await tx.securityLog.upsert({
                where: {
                    userId_sequenceNumber: {
                        userId: Number(record.userId),
                        sequenceNumber: record.seq,
                    },
                },
                update: {
                    previousHash: record.prevHash,
                    currentHash: record.hash,
                    hmacSignature,
                    auditData,
                },
                create: {
                    userId: Number(record.userId),
                    sequenceNumber: record.seq,
                    transactionId: Number(record.transactionId),
                    previousHash: record.prevHash,
                    currentHash: record.hash,
                    hmacSignature,
                    auditData,
                    createdAt: new Date(record.createdAt),
                },
            });

            if (i === history.length - 1) {
                await tx.securityChainState.upsert({
                    where: { userId: Number(record.userId) },
                    update: { latestSequence: record.seq, latestHash: record.hash },
                    create: {
                        userId: Number(record.userId),
                        latestSequence: record.seq,
                        latestHash: record.hash,
                    },
                });
            }

            restoredCount++;
        }

        return { userId, restoredTransactions: restoredCount, incidentId };
    });

    await unlockLedgerAfterRepair(incidentId);

    emit(EVENTS.LEDGER_UNLOCKED, {
        userId,
        message: "Ledger unlocked after repair",
        meta: { incidentId },
    });

    emit(EVENTS.REPAIR_COMPLETED, {
        userId,
        message: "Ledger repair completed",
        meta: {
            incidentId,
            restoredTransactions: repairedResult.restoredTransactions,
        },
    });

    return repairedResult;
}

module.exports = {
    fetchTransactionHistoryFromS3,
    lockLedgerForRepair,
    unlockLedgerAfterRepair,
    repairUserLedgerFromS3,
};
