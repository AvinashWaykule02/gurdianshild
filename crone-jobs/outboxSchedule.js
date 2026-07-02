const prisma = require("../config/prisma");
const auditQueue = require("../queues/auditQueue");


const POLL_INTERVAL_MS = 4000;
const POLL_LIMIT = 20;
const STUCK_PROCESSING_MS = 5 * 60 * 1000; // 5 minutes

let intervalId = null;
let isRunning = false;


// ATOMIC CLAIM (Prevents race conditions)
async function claimNextBatch() {
  const candidates = await prisma.auditOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: POLL_LIMIT,
    select: {
      id: true,
      transactionId: true,
      payload: true,
    },
  });

  const claimed = [];

  for (const event of candidates) {
    const result = await prisma.auditOutbox.updateMany({
      where: {
        id: event.id,
        status: "PENDING",
      },
      data: {
        status: "PROCESSING",
      },
    });

    // Only one poller can successfully claim a row
    if (result.count === 1) {
      claimed.push(event);
    }
  }

  return claimed;
}


// PUBLISH EVENTS TO QUEUE
async function publishPendingEvents() {
  const claimedEvents = await claimNextBatch();
  if (claimedEvents.length === 0) return 0;

  let publishedCount = 0;

  for (const event of claimedEvents) {
    try {
      await auditQueue.add("audit-event", {
        outboxEventId: event.id,
        transactionId: event.transactionId,
        payload: event.payload,
      });

      publishedCount++;
    } catch (err) {
      console.error(
        `[OutboxScheduler] Failed to enqueue event ${event.id}:`,
        err.message
      );

      // rollback → retry in next cycle
      await prisma.auditOutbox.update({
        where: { id: event.id },
        data: { status: "PENDING" },
      });
    }
  }

  return publishedCount;
}

// RECOVERY MECHANISM (Self-healing system)
async function resetStuckProcessingEvents() {
  const threshold = new Date(Date.now() - STUCK_PROCESSING_MS);

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
      `[OutboxScheduler] Reset ${result.count} stuck event(s)`
    );
  }

  return result.count;
}

// SINGLE CYCLE EXECUTION (Re-entrancy safe)
async function tick() {
  if (isRunning) return;

  isRunning = true;

  try {
    const count = await publishPendingEvents();

    if (count > 0) {
      console.log(`[OutboxScheduler] Published ${count} event(s)`);
    }
  } catch (err) {
    console.error("[OutboxScheduler] Error:", err.message);
  } finally {
    isRunning = false;
  }
}

// LIFECYCLE CONTROL
async function start() {
  if (intervalId) {
    console.warn("[OutboxScheduler] Already running");
    return;
  }

  console.log(
    `[OutboxScheduler] Started (interval: ${POLL_INTERVAL_MS}ms)`
  );

  // recover stuck jobs first
  await resetStuckProcessingEvents();

  // immediate execution
  await tick();

  // schedule polling
  intervalId = setInterval(tick, POLL_INTERVAL_MS);
}

function stop() {
  if (!intervalId) return;

  clearInterval(intervalId);
  intervalId = null;

  console.log("[OutboxScheduler] Stopped");
}



module.exports = {
  start,
  stop,
  publishPendingEvents,
  resetStuckProcessingEvents,
};

// crone-jobs/outboxSchedule.js
//
// Outbox Poller (DB → BullMQ Bridge)
// Ensures reliable delivery of AuditOutbox events to queue system.