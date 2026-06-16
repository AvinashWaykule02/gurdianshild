const { Worker } = require("bullmq");
const connection = require("../config/redis");
const { repairUserLedgerFromS3 } = require("../services/repairService");

const repairWorker = new Worker(
    "repair-queue",
    async (job) => {
        const { incidentId } = job.data;

        console.log(`[RepairWorker] Starting repair for incident ${incidentId}`);

        const result = await repairUserLedgerFromS3(incidentId);

        console.log(`[RepairWorker] Repair complete for incident ${incidentId}`);
        return result;
    },
    {
        connection,
        concurrency: 1,
    }
);

repairWorker.on("completed", (job) => {
    console.log(`[RepairWorker] Completed: ${job.id}`);
});

repairWorker.on("failed", (job, err) => {
    console.error(`[RepairWorker] Failed: ${job.id} → ${err.message}`);
});

module.exports = repairWorker;
