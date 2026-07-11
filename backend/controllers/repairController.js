const repairQueue = require("../queues/repairQueue");
const incidentRepository = require("../repositories/incidentRepository");
const prisma = require("../config/prisma");
const { emit, EVENTS } = require("../services/socketEventService");

// ---------------------------------------------------------------------------
// POST /api/repair/user   — SENIOR_MANAGER or SUPER_ADMIN
// Body: { userId }
//
// NOTE ON CONCURRENCY:
// The ledgerState.findUnique() check below is a fast, non-atomic UX
// shortcut — it lets us return a quick 409 for the obvious case. It is
// NOT the source of truth. Two concurrent requests for the same user can
// both pass this check before either job runs (classic read-check-act
// race), and `concurrency: 1` on the worker does not prevent that, since
// it only serializes execution, not enqueueing, and does nothing at all
// if you ever run more than one worker process.
//
// The actual guard against two repairs running for the same user lives in
// repairService.lockLedgerForRepair(), which does an atomic conditional
// update inside a DB transaction at the moment the job executes. That is
// what makes this safe even if duplicate jobs get queued.
//
// We additionally use a deterministic BullMQ jobId here so that, in the
// common case, a duplicate request never even gets queued as a second job.
// ---------------------------------------------------------------------------
async function triggerRepair(req, res) {
    try {
        const { userId } = req.body;
        if (!userId || isNaN(userId)) {
            return res.status(400).json({ success: false, message: "userId is required and must be a number" });
        }

        // Confirm user exists
        const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
        if (!user) {
            return res.status(404).json({ success: false, message: `User ${userId} not found` });
        }

        // Find the latest approved incident for this user.
        // Only APPROVED incidents may be queued for repair — repairService
        // enforces this too, but failing fast here avoids wasted queue jobs.
        const incident = await prisma.incident.findFirst({
            where: {
                userId: Number(userId),
                status: "APPROVED",
            },
            orderBy: { createdAt: "desc" },
        });

        if (!incident) {
            return res.status(400).json({
                success: false,
                message: `No approved incident found for user ${userId}.`,
            });
        }

        // Fast, non-authoritative pre-check (see note above) — good UX,
        // not a correctness guarantee.
        const ledger = await prisma.ledgerState.findUnique({
            where: { userId: Number(userId) },
        });

        if (ledger && ledger.status === "UNDER_REPAIR") {
            return res.status(409).json({
                success: false,
                message: `Repair already in progress for user ${userId}`,
            });
        }

        // Deterministic jobId => BullMQ will not create a second waiting/active
        // job with the same id, so a duplicate request racing in right after
        // the check above still can't double-enqueue for this user.
        const jobId = `repair-user-${userId}`;

        // BullMQ will not create a second waiting/active/delayed job that
        // shares an existing jobId — it returns a reference to the existing
        // job instead. So even if a duplicate request slips past the
        // findUnique() check above, it converges on the same queued job
        // rather than creating a second one.
        await repairQueue.add(
            "repair-user",
            {
                userId: Number(userId),
                incidentId: Number(incident.id),
            },
            { jobId }
        );

        emit(EVENTS.REPAIR_STARTED, {
            userId: Number(userId),
            message: "Repair job queued",
            meta: { incidentId: Number(incident.id), status: "QUEUED" },
        });

        return res.status(202).json({
            success: true,
            message: "Repair job queued",
            data: {
                userId: Number(userId),
                incidentId: Number(incident.id),
            },
        });
    } catch (err) {
        console.error("triggerRepair error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    triggerRepair,
};