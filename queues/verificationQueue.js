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

const verificationQueue = new Queue("gs:verificationQueue", {
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