if (process.env.NODE_ENV === "test") {
  module.exports = {
    add: async () => ({ id: "test-job" }),
    on: () => {},
  };
  return;
}

const { Queue } = require("bullmq");
const connection = require("../config/redis");

/*
|--------------------------------------------------------------------------
| VERIFICATION QUEUE (BullMQ)
|--------------------------------------------------------------------------
| Purpose:
| → Stores user-level audit verification jobs
| → Consumed by verification worker
|
| Flow:
| Cron → Queue → Worker → Verification Engine
|--------------------------------------------------------------------------
*/

const verificationQueue = new Queue("verification-queue", {
  connection,

  defaultJobOptions: {
    attempts: 3,

    backoff: {
      type: "exponential",
      delay: 5000,
    },

    removeOnComplete: true,
    removeOnFail: false,
  },
});

module.exports = verificationQueue;