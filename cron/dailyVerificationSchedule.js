const cron = require("node-cron");

const {
  scheduleNightlyVerification,
} = require("../cron-jobs/scheduleVerification");

/*
|--------------------------------------------------------------------------
| NIGHTLY HASH CHAIN VERIFICATION
|--------------------------------------------------------------------------
| Runs every day at 12:00 AM server time
|
| Cron: 0 0 * * *
|
| Flow:
|   Trigger → Full chain verification → Store report → log results
|--------------------------------------------------------------------------
*/

let isRunning = false;

cron.schedule("0 0 * * *", async () => {
  if (isRunning) {
    console.warn("[CRON] Nightly verification already running — skipping");
    return;
  }

  isRunning = true;

  try {
    console.log("\n[CRON] Nightly Verification Started");

    await scheduleNightlyVerification();

    console.log("[CRON] Nightly Verification Completed\n");
  } catch (err) {
    console.error("[CRON] Nightly Verification Failed:", err.message);
  } finally {
    isRunning = false;
  }
});