// TEST MODE (No Redis dependency)
if (process.env.NODE_ENV === "test") {
  module.exports = {
    add: async () => ({ id: "test-job" }),
    on: () => {},
    process: () => {},
    close: async () => {},
    getJobs: async () => [],
    getJobCounts: async () => ({}),
    pause: async () => {},
    resume: async () => {},
  };
  return;
}

// PRODUCTION MODE (BullMQ + Redis)
const { Queue } = require("bullmq");
const connection = require("../config/redis");

// Create single audit queue instance
const auditQueue = new Queue("audit-queue", {
  connection,

  defaultJobOptions: {
    // Retry failed jobs up to 3 times
    attempts: 3,

    // Exponential backoff: 2s → 4s → 8s
    backoff: {
      type: "exponential",
      delay: 2000,
    },

    // Keep only last 100 completed jobs (Redis cleanup)
    removeOnComplete: { count: 100 },

    // Keep last 1000 failed jobs for debugging
    removeOnFail: { count: 1000 },
  },
});

// QUEUE ERROR HANDLING
auditQueue.on("error", (err) => {
  console.error("[AuditQueue] Redis/BullMQ error:", err.message);
});


module.exports = auditQueue;

// queues/auditQueue.js
//
// Audit Queue (BullMQ)
// Single queue used for processing all audit-related events.
//
// Test mode → returns a mock queue (no Redis required)

