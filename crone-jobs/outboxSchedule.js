// src/jobs/outbox.publisher.job.js
//
// PUBLISHER JOB — Scheduler for DB → Queue bridge
//
// Runs publisher service every 4 seconds using setInterval

const {
  publishPendingEvents,
  resetStuckProcessingEvents,
} = require("../services/outboxPublisher");

const POLL_INTERVAL_MS = 4000;

let intervalId = null;
let isRunning = false;

/**
 * Single execution cycle
 */
async function tick() {
  // Prevent overlapping executions
  if (isRunning) {
    console.warn(
      "[PublisherJob] Previous cycle still running — skipping"
    );
    return;
  }

  isRunning = true;

  try {
    const count = await publishPendingEvents();

    if (count > 0) {
      console.log(
        `[PublisherJob] Published ${count} event(s)`
      );
    }
  } catch (err) {
    console.error(
      "[PublisherJob] Error:",
      err.message
    );
  } finally {
    isRunning = false;
  }
}

/**
 * Start job
 */
async function start() {
  if (intervalId) {
    console.warn(
      "[PublisherJob] Already running"
    );
    return;
  }

  console.log(
    `[PublisherJob] Started (interval ${POLL_INTERVAL_MS}ms)`
  );

  // Recovery step on startup
  await resetStuckProcessingEvents();

  // Run immediately once
  await tick();

  // Schedule repeated execution
  intervalId = setInterval(tick, POLL_INTERVAL_MS);
}

/**
 * Stop job
 */
function stop() {
  if (!intervalId) return;

  clearInterval(intervalId);
  intervalId = null;

  console.log("[PublisherJob] Stopped");
}

module.exports = {
  start,
  stop,
};