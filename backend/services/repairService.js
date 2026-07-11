const crypto = require("crypto");
const prisma = require("../config/prisma");
const { emit, EVENTS } = require("./socketEventService");
const incidentRepository = require("../repositories/incidentRepository");
const { listUserBackups, getObjectBody } = require("../repositories/s3BackupRepository");

// ---------------------------------------------------------------------------
// CRYPTO HELPERS
// ---------------------------------------------------------------------------
function generateHmac(data, secret) {
    return crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(data))
        .digest("hex");
}

// ---------------------------------------------------------------------------
// S3 RESTORE — fetch full sorted history for a user
// Any unparsable backup object is a hard error rather than a silently
// dropped record — a repair must never proceed on a gappy/partial history.
// ---------------------------------------------------------------------------
async function fetchTransactionHistoryFromS3(userId) {
    const backups = await listUserBackups(userId, 1000);
    const history = [];

    for (const backup of backups) {
        const body = await getObjectBody(backup.Key);
        if (!body) {
            throw new Error(`[RepairService] Empty backup body for key ${backup.Key}`);
        }

        try {
            history.push(JSON.parse(body));
        } catch (err) {
            throw new Error(
                `[RepairService] Failed to parse backup ${backup.Key}: ${err.message}`
            );
        }
    }

    return history.sort((a, b) => a.seq - b.seq);
}

// ---------------------------------------------------------------------------
// Verify the restored slice of history is contiguous (no missing sequence
// numbers) from startIndex through the end of history.
// ---------------------------------------------------------------------------
function assertContiguousHistory(history, startIndex) {
    for (let i = startIndex + 1; i < history.length; i++) {
        const prevSeq = history[i - 1].seq;
        const currSeq = history[i].seq;

        if (currSeq !== prevSeq + 1) {
            throw new Error(
                `[RepairService] Gap detected in S3 history: sequence ${prevSeq} is followed by ${currSeq} (expected ${prevSeq + 1})`
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Verify the restored range attaches correctly to the trusted portion of
// the chain already in the DB.
// ---------------------------------------------------------------------------
async function assertBoundaryLinksToTrustedChain(userId, history, startIndex) {
    const firstRestored = history[startIndex];

    if (!firstRestored.prevHash) {
        // Genuinely the start of the chain — nothing to attach to.
        return;
    }

    const priorSeq = firstRestored.seq - 1;

    const priorLog = await prisma.securityLog.findUnique({
        where: {
            userId_sequenceNumber: {
                userId: Number(userId),
                sequenceNumber: priorSeq,
            },
        },
    });

    if (!priorLog) {
        throw new Error(
            `[RepairService] Cannot verify chain attachment: no existing log found at sequence ${priorSeq} for user ${userId}`
        );
    }

    if (priorLog.currentHash !== firstRestored.prevHash) {
        throw new Error(
            `[RepairService] Chain attachment mismatch at sequence ${priorSeq}: ` +
            `DB currentHash does not match prevHash of restored record ${firstRestored.seq}. ` +
            `Refusing to repair onto a broken boundary.`
        );
    }
}

// ---------------------------------------------------------------------------
// LOCK — atomically mark one user's ledger as UNDER_REPAIR.
//
// This is the authoritative concurrency guard for the whole repair flow.
// The controller's pre-check (findUnique before enqueueing) is only a fast,
// non-atomic UX shortcut — two requests can both pass it. This function is
// what actually prevents two repairs from running for the same user:
//
//   - If a ledgerState row already exists, we try to flip it to
//     UNDER_REPAIR only where status != UNDER_REPAIR. Postgres/MySQL row
//     locking on the UPDATE means, if two transactions race, exactly one
//     of them will see rowCount === 1 and the other will see 0.
//   - If no row exists yet, we attempt a create guarded by the unique
//     constraint on userId. If two transactions race to create it, one
//     succeeds and the other hits a unique-constraint violation, which we
//     translate into the same "already in progress" error.
//
// Either way, whichever caller loses the race throws before touching any
// transaction/securityLog rows, so at most one repair can proceed per user
// regardless of how many jobs got enqueued or how many workers are running.
// ---------------------------------------------------------------------------
async function lockLedgerForRepair(userId, incidentId) {
    const numericUserId = Number(userId);

    await prisma.$transaction(async (tx) => {
        const updateResult = await tx.ledgerState.updateMany({
            where: {
                userId: numericUserId,
                status: { not: "UNDER_REPAIR" },
            },
            data: {
                status: "UNDER_REPAIR",
                lockedAt: new Date(),
                lockedReason: "Chain repair in progress",
                incidentId: Number(incidentId),
            },
        });

        if (updateResult.count === 1) {
            return; // won the race, lock acquired
        }

        // Either the row doesn't exist yet, or it's already UNDER_REPAIR.
        const existing = await tx.ledgerState.findUnique({
            where: { userId: numericUserId },
        });

        if (existing) {
            // It exists and updateMany matched 0 rows => it must already be UNDER_REPAIR.
            throw new Error(`Repair already in progress for user ${userId}`);
        }

        try {
            await tx.ledgerState.create({
                data: {
                    userId: numericUserId,
                    status: "UNDER_REPAIR",
                    lockedAt: new Date(),
                    lockedReason: "Chain repair in progress",
                    incidentId: Number(incidentId),
                },
            });
        } catch (err) {
            // Unique constraint violation => another transaction created it first.
            throw new Error(`Repair already in progress for user ${userId}`);
        }
    });

    return incidentRepository.updateIncidentStatus(incidentId, "REPAIRING");
}

// ---------------------------------------------------------------------------
// UNLOCK — called EXPLICITLY by SUPERADMIN only (not auto-called after repair)
// ---------------------------------------------------------------------------
async function unlockRepairedLedger(userId) {
    const ledger = await prisma.ledgerState.findUnique({
        where: { userId: Number(userId) },
    });

    if (!ledger) {
        throw new Error(`No ledger state found for user ${userId}`);
    }

    if (ledger.status !== "UNDER_REPAIR") {
        throw new Error(
            `Ledger for user ${userId} is in status "${ledger.status}" — can only unlock when UNDER_REPAIR`
        );
    }

    const incidentId = ledger.incidentId;

    // Mark ledger ACTIVE
    await prisma.ledgerState.update({
        where: { userId: Number(userId) },
        data: {
            status: "ACTIVE",
            lockedAt: null,
            lockedReason: null,
            incidentId: null,
        },
    });

    // Mark incident RESOLVED (if it exists and is still REPAIRING)
    if (incidentId) {
        const incident = await incidentRepository.findIncidentById(incidentId);
        if (incident && incident.status === "REPAIRING") {
            await incidentRepository.updateIncidentStatus(incidentId, "RESOLVED");
        }
    }

    emit(EVENTS.LEDGER_UNLOCKED, {
        userId,
        message: "Ledger unlocked by SUPERADMIN after repair",
        meta: { incidentId },
    });

    return { userId, unlockedAt: new Date(), incidentId };
}

// ---------------------------------------------------------------------------
// REPAIR — restore from S3 + rebuild hash chain in DB for a specific user
// ---------------------------------------------------------------------------
async function repairUserLedgerFromS3(userId, incidentId) {
    // Validate incident belongs to this user and is APPROVED
    const incident = await incidentRepository.findIncidentById(incidentId);
    if (!incident) {
        throw new Error(`Incident ${incidentId} not found`);
    }
    if (Number(incident.userId) !== Number(userId)) {
        throw new Error(`Incident ${incidentId} does not belong to user ${userId}`);
    }
    if (incident.status !== "APPROVED") {
        throw new Error(
            `Incident ${incidentId} must be APPROVED before repair (current: ${incident.status})`
        );
    }

    // Fetch full S3 history for this user (throws on any unparsable/missing record)
    const history = await fetchTransactionHistoryFromS3(userId);

    if (!history.length) {
        throw new Error(`No S3 backup history found for user ${userId}`);
    }

    const corruptionStartSeq = incident.corruptionStartSeq;
    const startIndex = history.findIndex((record) => record.seq >= corruptionStartSeq);

    if (startIndex === -1) {
        throw new Error(`Corruption start sequence ${corruptionStartSeq} not found in S3 history`);
    }

    // Refuse to repair on top of a gappy or misattached history.
    assertContiguousHistory(history, startIndex);
    await assertBoundaryLinksToTrustedChain(userId, history, startIndex);

    // Atomically claim the lock. This is the authoritative concurrency
    // guard — if another job/request already holds it, this throws here
    // and nothing below is executed.
    await lockLedgerForRepair(userId, incidentId);

    emit(EVENTS.LEDGER_LOCKED, {
        userId,
        severity: "WARN",
        message: "Ledger locked — repair started",
        meta: { incidentId },
    });

    // Atomic: restore all records from S3 from corruption point onward
    const hmacSecret = process.env.JWT_SECRET || "guardian-shield-secret";

    const repairedResult = await prisma.$transaction(async (tx) => {
        let restoredCount = 0;

        for (let i = startIndex; i < history.length; i++) {
            const record = history[i];

            // Restore the transaction row (create if it was deleted or corrupted)
            await tx.transaction.upsert({
                where: { id: Number(record.transactionId) },
                update: {
                    userId: Number(record.userId),
                    amount: String(record.transactionData?.amount ?? 0),
                    description: record.transactionData?.description ?? "",
                    createdAt: new Date(record.createdAt),
                },
                create: {
                    id: Number(record.transactionId),
                    userId: Number(record.userId),
                    amount: String(record.transactionData?.amount ?? 0),
                    description: record.transactionData?.description ?? "",
                    createdAt: new Date(record.createdAt),
                },
            });

            // Reconstruct audit data from S3 record
            const auditData = record.auditLog?.auditData || {
                id: record.transactionData.id,
                userId: record.transactionData.userId,
                amount: String(record.transactionData.amount),
                description: record.transactionData.description,
                createdAt: record.transactionData.createdAt,
            };

            // Use the same hash timestamp that was originally used to create the
            // currentHash. The audit worker stores this in the securityLog row,
            // and verification will recompute using that timestamp. Falling back
            // to S3's createdAt can silently break verification after repair.
            const existingLog = await tx.securityLog.findUnique({
                where: {
                    userId_sequenceNumber: {
                        userId: Number(record.userId),
                        sequenceNumber: record.seq,
                    },
                },
            });
            const hashTimestamp = existingLog?.createdAt ?? new Date(record.createdAt);

            const rebuiltHash = require("../algorithams/generateHash").generateHash(
                auditData,
                record.prevHash,
                hashTimestamp
            );

            // Regenerate HMAC using the S3-trusted hashes (ground truth)
            const hmacSignature = generateHmac(
                {
                    auditData,
                    previousHash: record.prevHash,
                    currentHash: rebuiltHash,
                    sequenceNumber: record.seq,
                },
                hmacSecret
            );

            // Upsert the security log entry (restore chain link)
            //
            // IMPORTANT — createdAt handling:
            // The upstream audit worker has a bug where the createdAt value
            // written into S3 backups (record.createdAt) is NOT the same
            // timestamp that was actually hashed into record.hash — so
            // trusting S3's createdAt here can never reproduce a matching
            // hash at verification time, even for a perfectly clean repair.
            //
            // Mitigation without touching the write path: when the row
            // already exists in the DB (tampered, not deleted), its
            // createdAt is presumed to be the original value the hash was
            // actually generated from — attackers who alter amount/
            // description/currentHash typically don't also rewrite
            // createdAt to stay self-consistent. So on UPDATE we leave
            // createdAt untouched instead of overwriting it from S3.
            //
            // This is a best-effort assumption, not a guarantee — if
            // createdAt itself was part of what got tampered, this won't
            // catch it. It also cannot help the CREATE path (row was
            // deleted, nothing in the DB to fall back on) — in that case
            // S3's createdAt is used as a last resort and the restored
            // hash may still fail verification. The only fully correct fix
            // is at the write path (auditWorker.js), which is out of scope
            // for this change.
            await tx.securityLog.upsert({
                where: {
                    userId_sequenceNumber: {
                        userId: Number(record.userId),
                        sequenceNumber: record.seq,
                    },
                },
                update: {
                    previousHash: record.prevHash,
                    currentHash: rebuiltHash,
                    hmacSignature,
                    auditData,
                    // Preserves the existing DB createdAt so verification uses the
                    // same timestamp that originally produced the chain hash.
                    createdAt: hashTimestamp,
                },
                create: {
                    userId: Number(record.userId),
                    sequenceNumber: record.seq,
                    transactionId: Number(record.transactionId),
                    previousHash: record.prevHash,
                    currentHash: rebuiltHash,
                    hmacSignature,
                    auditData,
                    createdAt: hashTimestamp,
                },
            });

            // Update chain-head pointer on the last record
            if (i === history.length - 1) {
                await tx.securityChainState.upsert({
                    where: { userId: Number(record.userId) },
                    update: {
                        latestSequence: record.seq,
                        latestHash: rebuiltHash,
                    },
                    create: {
                        userId: Number(record.userId),
                        latestSequence: record.seq,
                        latestHash: rebuiltHash,
                    },
                });
            }

            restoredCount++;
        }

        return { userId, restoredTransactions: restoredCount, incidentId };
    });

    // Emit repair-complete event — ledger stays UNDER_REPAIR until SUPERADMIN unlocks
    emit(EVENTS.REPAIR_COMPLETED, {
        userId,
        message: "Ledger chain restored from S3. Awaiting SUPERADMIN unlock.",
        meta: {
            incidentId,
            restoredTransactions: repairedResult.restoredTransactions,
        },
    });

    return repairedResult;
}

module.exports = {
    fetchTransactionHistoryFromS3,
    assertContiguousHistory,
    assertBoundaryLinksToTrustedChain,
    lockLedgerForRepair,
    unlockRepairedLedger,      // ← explicit SUPERADMIN unlock
    repairUserLedgerFromS3,    // ← takes (userId, incidentId)
};