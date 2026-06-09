const { Worker } = require("bullmq");
const connection = require("../config/redis");
const { verifyUserHashChain } = require("../algorithams/verifyHashchain");

/*
|--------------------------------------------------------------------------
| VERIFICATION WORKER (BACKGROUND ENGINE)
|--------------------------------------------------------------------------
| Listens to:
| → verificationQueue
|
| Runs:
| → hash chain validation
| → fraud detection
|--------------------------------------------------------------------------
*/

const worker = new Worker(
  "verificationQueue",

  async (job) => {
    try {

      console.log("\n================================");
      console.log("🔍 VERIFICATION JOB STARTED");
      console.log("================================");

      // STEP 1 → Extract Data
      const { userId } = job.data;

      console.log("User ID:", userId);

      // STEP 2 → Run Verification Engine
      const result = await verifyUserHashChain(userId);

      // STEP 3 → Result Handling
      if (result.valid) {
        console.log("✅ HASH CHAIN VERIFIED");
      } else {
        console.log("🚨 TAMPERING DETECTED");
        console.log("Incidents:", result.incidents);
      }

      console.log(`📊 Total Logs Checked: ${result.totalChecked}`);
      console.log("================================\n");

      return result;

    } catch (err) {
      console.error("❌ Worker Error:", err.message);
      throw err; // important for BullMQ retry system
    }
  },

  {
    connection,
    concurrency: 2 // ⚡ allows parallel verification (important for scale)
  }
);

/*
|--------------------------------------------------------------------------
| WORKER EVENTS
|--------------------------------------------------------------------------
*/

// Job completed
worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

// Job failed
worker.on("failed", (job, err) => {
  console.log(`❌ Job ${job?.id} failed`);
  console.log("Error:", err.message);
});

// Worker ready
worker.on("ready", () => {
  console.log("🚀 Verification Worker is running...");
});