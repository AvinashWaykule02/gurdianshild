if (process.env.NODE_ENV === "test") {
    module.exports = {
        add: async () => ({ id: "test-job" }),
        on: () => {},
    };
    return;
}

// src/queues/audit.queue.js
//
// AUDIT QUEUE — The single BullMQ queue for all audit events.
//
// Design decisions:
//   - One queue named "audit-queue". All audit events flow through here.
//   - defaultJobOptions ensure failed jobs are retried up to 3 times
//     with exponential backoff before being moved to the failed set.
//   - removeOnComplete keeps Redis lean — we already have the permanent
//     record in PostgreSQL (AuditOutbox + SecurityLog tables).
//   - removeOnFail: false — keep failed jobs in Redis so you can inspect
//     them in Bull Board / Redis CLI without losing context.

const { Queue } = require("bullmq");
const connection = require("../config/redis");

const auditQueue = new Queue("audit-queue", {
    connection,

    defaultJobOptions: {
        // Retry up to 3 times before marking the job as failed
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000, // 2s → 4s → 8s
        },

        // Remove completed jobs from Redis after 100 are accumulated
        // (keeps memory clean — source of truth is PostgreSQL)
        removeOnComplete: { count: 100 },

        // Keep failed jobs for inspection
        removeOnFail: false,
    },
});

// Log queue-level errors (connection drops, etc.)
auditQueue.on("error", (err) => {
    console.error("[AuditQueue] Queue error:", err.message);
});

module.exports = auditQueue;
