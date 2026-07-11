const prisma = require("../config/prisma");
const repairQueue = require("../queues/repairQueue");
const { verifyUserHashChain } = require("../algorithams/verifyHashchain");
const { unlockRepairedLedger } = require("../services/repairService");
const { emit, EVENTS } = require("../services/socketEventService");

// ---------------------------------------------------------------------------
// GET /api/admin/overview
// ---------------------------------------------------------------------------
async function getAdminOverview(req, res) {
    try {
        const [users, transactions, incidents, lockedUsers] = await Promise.all([
            prisma.user.findMany({
                select: { id: true, name: true, email: true, role: true, createdAt: true },
                orderBy: { createdAt: "desc" },
            }),
            prisma.transaction.findMany({
                select: { id: true, userId: true, amount: true, description: true, createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            prisma.incident.findMany({
                select: { id: true, userId: true, status: true, severity: true, title: true, createdAt: true },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
            // Only fetch LOCKED or UNDER_REPAIR ledger states (corrupted users)
            prisma.ledgerState.findMany({
                where: { status: { in: ["LOCKED", "UNDER_REPAIR"] } },
                select: {
                    userId: true,
                    status: true,
                    lockedReason: true,
                    lockedAt: true,
                    incidentId: true,
                    user: { select: { id: true, name: true, email: true, role: true } },
                },
            }),
        ]);

        return res.status(200).json({
            success: true,
            data: { users, transactions, incidents, lockedUsers },
        });
    } catch (error) {
        console.error("getAdminOverview error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ---------------------------------------------------------------------------
// GET /api/admin/users/:userId/transactions
// ---------------------------------------------------------------------------
async function getAdminUserTransactions(req, res) {
    try {
        const { userId } = req.params;
        const transactions = await prisma.transaction.findMany({
            where: { userId: Number(userId) },
            orderBy: { createdAt: "desc" },
            include: { user: { select: { id: true, name: true, email: true } } },
        });

        return res.status(200).json({ success: true, data: transactions });
    } catch (error) {
        console.error("getAdminUserTransactions error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ---------------------------------------------------------------------------
// GET /api/admin/users/:userId/incidents
// ---------------------------------------------------------------------------
async function getAdminUserIncidents(req, res) {
    try {
        const { userId } = req.params;
        const incidents = await prisma.incident.findMany({
            where: { userId: Number(userId) },
            orderBy: { createdAt: "desc" },
        });

        return res.status(200).json({ success: true, data: incidents });
    } catch (error) {
        console.error("getAdminUserIncidents error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ---------------------------------------------------------------------------
// GET /api/admin/users/:userId/ledger-status
// Returns the live LedgerState for a specific user
// ---------------------------------------------------------------------------
async function getUserLedgerStatus(req, res) {
    try {
        const { userId } = req.params;

        const ledger = await prisma.ledgerState.findUnique({
            where: { userId: Number(userId) },
            include: {
                incident: {
                    select: {
                        id: true,
                        status: true,
                        severity: true,
                        title: true,
                        description: true,
                        corruptionStartSeq: true,
                        createdAt: true,
                    },
                },
            },
        });

        // If no ledger row exists yet the user is implicitly ACTIVE
        if (!ledger) {
            return res.status(200).json({
                success: true,
                data: { userId: Number(userId), status: "ACTIVE", lockedAt: null, lockedReason: null, incident: null },
            });
        }

        return res.status(200).json({ success: true, data: ledger });
    } catch (error) {
        console.error("getUserLedgerStatus error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ---------------------------------------------------------------------------
// POST /api/admin/users/:userId/verify
// ---------------------------------------------------------------------------
async function verifyUserLedger(req, res) {
    try {
        const { userId } = req.params;
        const verification = await verifyUserHashChain(Number(userId));

        return res.status(200).json({
            success: true,
            message: verification.valid ? "Chain is healthy" : "Chain issues detected",
            data: verification,
        });
    } catch (error) {
        console.error("verifyUserLedger error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ---------------------------------------------------------------------------
// POST /api/admin/users/:userId/repair
// Queues a repair job for a specific user (SUPERADMIN finds latest APPROVED incident)
// ---------------------------------------------------------------------------
async function repairUserChain(req, res) {
    try {
        const { userId } = req.params;

        const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
        if (!user) {
            return res.status(404).json({ success: false, message: `User ${userId} not found` });
        }

        // Check for an in-progress repair
        const ledger = await prisma.ledgerState.findUnique({ where: { userId: Number(userId) } });
        if (ledger && ledger.status === "UNDER_REPAIR") {
            return res.status(409).json({
                success: false,
                message: `Repair already in progress for user ${userId}. Unlock first or wait for it to finish.`,
            });
        }

        // Find the latest active incident
        const incident = await prisma.incident.findFirst({
            where: { userId: Number(userId), status: { in: ["OPEN", "UNDER_REVIEW", "APPROVED"] } },
            orderBy: { createdAt: "desc" },
        });

        if (!incident) {
            return res.status(400).json({
                success: false,
                message: `No active incident found for user ${userId}.`,
            });
        }

        await repairQueue.add("repair-user", {
            userId: Number(userId),
            incidentId: Number(incident.id),
        });

        emit(EVENTS.REPAIR_STARTED, {
            userId: Number(userId),
            message: "Repair job queued by SUPERADMIN",
            meta: { incidentId: Number(incident.id), status: "QUEUED" },
        });

        return res.status(202).json({
            success: true,
            message: "Repair job queued",
            data: { userId: Number(userId), incidentId: Number(incident.id) },
        });
    } catch (error) {
        console.error("repairUserChain error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

// ---------------------------------------------------------------------------
// POST /api/admin/users/:userId/unlock
// Explicitly unlocks a user's ledger AFTER repair is confirmed — SUPERADMIN only
// ---------------------------------------------------------------------------
async function unlockUserLedger(req, res) {
    try {
        const { userId } = req.params;

        const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // unlockRepairedLedger validates that status is UNDER_REPAIR before proceeding
        const result = await unlockRepairedLedger(Number(userId));

        return res.status(200).json({
            success: true,
            message: `Ledger for user ${userId} unlocked successfully`,
            data: result,
        });
    } catch (error) {
        console.error("unlockUserLedger error:", error);
        return res.status(400).json({ success: false, message: error.message });
    }
}

module.exports = {
    getAdminOverview,
    getAdminUserTransactions,
    getAdminUserIncidents,
    getUserLedgerStatus,
    verifyUserLedger,
    repairUserChain,
    unlockUserLedger,
};
