const { Worker } = require("bullmq");
const connection = require("../config/redis");
const { repairUserLedgerFromS3 } = require("../services/repairService");

const repairWorker = new Worker(
    "repair-queue",
    async (job) => {
        const { userId, incidentId } = job.data;
        console.log(`[RepairWorker] Starting repair for user ${userId}, incident ${incidentId}`);

        // Restore S3 → rebuild hash chain → ledger stays UNDER_REPAIR (no auto-unlock)
        const result = await repairUserLedgerFromS3(userId, incidentId);

        console.log(
            `[RepairWorker] Repair complete for user ${userId}: ${result.restoredTransactions} records restored. ` +
            `Ledger is UNDER_REPAIR — SUPERADMIN must explicitly unlock.`
        );

        return result;
    },
    {
        connection,
        concurrency: 1, // process one repair at a time to preserve chain integrity
    }
);

repairWorker.on("completed", (job) => {
    console.log(`[RepairWorker] Job ${job.id} completed — userId=${job.data.userId}`);
});

repairWorker.on("failed", (job, err) => {
    console.error(`[RepairWorker] Job ${job.id} failed — userId=${job.data.userId}: ${err.message}`);
});

module.exports = repairWorker;