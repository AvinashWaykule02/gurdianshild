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
    await prisma.auditOutbox.update({
      where: { id: event.id },
      data: { status: "PROCESSING" },
    });

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

  const result = await prisma.auditOutbox.updateMany({
    where: {
      status: "PROCESSING",
      createdAt: { lte: threshold },
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
