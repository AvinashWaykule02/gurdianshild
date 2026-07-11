if (process.env.NODE_ENV === "test") {
    module.exports = {
        add: async () => ({ id: "test-job" }),
        on: () => {},
    };
    return;
}

const { Queue } = require("bullmq");
const connection = require("../config/redis");

const repairQueue = new Queue("repair-queue", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: false,
    },
});

repairQueue.on("error", (err) => {
    console.error("[RepairQueue] Queue error:", err.message);
});

module.exports = repairQueue;
