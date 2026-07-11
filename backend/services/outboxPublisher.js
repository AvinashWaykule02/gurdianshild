const prisma = require("../config/prisma");
const auditQueue = require("../queues/auditQueue");

const POLL_LIMIT = 20;
const STUCK_PROCESSING_MS = 5 * 60 * 1000;

async function publishPendingEvents() {
    const pendingEvents = await prisma.auditOutbox.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: POLL_LIMIT,
    });

    if (!pendingEvents.length) {
        return 0;
    }

    let publishedCount = 0;

    for (const event of pendingEvents) {
        // Atomically claim this event before enqueueing it. Using a plain
        // update-by-id here (with no status guard) would let two publisher
        // instances — or two overlapping runs of this same function — both
        // see the row as PENDING, both flip it to PROCESSING, and both
        // enqueue a duplicate job for the same transaction. Guarding the
        // update with `status: "PENDING"` means only one caller's update
        // can ever match the row; the loser sees count === 0 and skips it
        // instead of double-enqueueing.
        const claim = await prisma.auditOutbox.updateMany({
            where: { id: event.id, status: "PENDING" },
            data: { status: "PROCESSING" },
        });

        if (claim.count === 0) {
            // Another publisher (or the stuck-event resetter) already
            // claimed or moved this row between our findMany and now.
            continue;
        }

        try {
            await auditQueue.add("audit-event", {
                outboxEventId: Number(event.id),
                transactionId: event.transactionId,
                payload: event.payload,
            });
            publishedCount += 1;
        } catch (err) {
            console.error(
                `[OutboxPublisher] Failed to enqueue event ${event.id}:`,
                err.message
            );

            await prisma.auditOutbox.update({
                where: { id: event.id },
                data: { status: "PENDING" },
            });
        }
    }

    return publishedCount;
}

async function resetStuckProcessingEvents() {
    const threshold = new Date(Date.now() - STUCK_PROCESSING_MS);

    // Must compare against `updatedAt`, not `createdAt`. `createdAt` is
    // fixed at the moment the outbox row was first inserted — it has
    // nothing to do with how long the row has been sitting in the
    // PROCESSING state. If an event waited a while as PENDING before a
    // worker finally claimed it, its createdAt could already be older than
    // the stuck threshold the instant it flips to PROCESSING — causing
    // this function to immediately reset a perfectly healthy, actively-
    // processing event back to PENDING and triggering a duplicate enqueue.
    // `updatedAt` (auto-bumped by Prisma on every write, including the
    // PENDING -> PROCESSING transition) correctly measures time-in-state.
    const result = await prisma.auditOutbox.updateMany({
        where: {
            status: "PROCESSING",
            updatedAt: { lte: threshold },
        },
        data: {
            status: "PENDING",
        },
    });

    if (result.count > 0) {
        console.log(
            `[OutboxPublisher] Reset ${result.count} stuck event(s) to PENDING`
        );
    }

    return result.count;
}

module.exports = {
    publishPendingEvents,
    resetStuckProcessingEvents,
};