const prisma = require("../config/prisma");
const verificationQueue = require("../queues/verificationQueue");

/*
|--------------------------------------------------------------------------
| NIGHTLY VERIFICATION SCHEDULER
|--------------------------------------------------------------------------
| Pushes all users into verification queue for audit check
| Runs as batch job triggered by cron
|--------------------------------------------------------------------------
*/

async function scheduleNightlyVerification() {
  console.log("[Scheduler] Starting nightly verification job...");

  // 1. Fetch all users from PostgreSQL
  const users = await prisma.user.findMany({
    select: {
      id: true,
    },
  });

  if (!users.length) {
    console.log("[Scheduler] No users found");
    return;
  }

  let count = 0;

  // 2. Push each user into BullMQ queue
  for (const user of users) {
    await verificationQueue.add(
      "verify-user-chain",
      {
        userId: user.id,
      },
      {
        attempts: 3,
        removeOnComplete: true,
        jobId: `verify-${user.id}`, // prevents duplicate jobs
      }
    );

    count++;
  }

  console.log(`[Scheduler] Scheduled ${count} verification jobs`);
}

module.exports = {
  scheduleNightlyVerification,
};