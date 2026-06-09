const prisma = require("../config/prisma");
const { generateHash } = require("./generateHash");

/**
 * Fetch last chain state
 */
async function getChainState(tx) {
    return await tx.securityChainState.findUnique({
        where: { id: 1 },
    });
}

/**
 * Update chain state after new log
 */
async function updateChainState(tx, latestHash, sequenceNumber) {
    return await tx.securityChainState.update({
        where: { id: 1 },
        data: {
            latestHash,
            latestSequence: sequenceNumber,
            updatedAt: new Date(),
        },
    });
}

/**
 * CORE FUNCTION
 * Creates immutable audit log entry
 */
async function appendAuditLog({ transaction }) {
    return await prisma.$transaction(async (tx) => {
        // 1. Get chain state
        const chain = await getChainState(tx);

        const previousHash = chain?.latestHash || "GENESIS";
        const nextSequence = (chain?.latestSequence || 0) + 1;

        // 2. Prepare audit data snapshot
        const auditData = {
            transactionId: transaction.id,
            userId: transaction.userId,
            amount: transaction.amount.toString(),
            description: transaction.description,
            createdAt: transaction.createdAt,
        };

        // 3. Generate hash
        const currentHash = generateHash(
            auditData,
            previousHash,
            new Date()
        );

        // 4. Create security log
        const log = await tx.securityLog.create({
            data: {
                sequenceNumber: nextSequence,
                transactionId: transaction.id,
                previousHash,
                currentHash,
                auditData,
            },
        });

        // 5. Update chain state
        await updateChainState(tx, currentHash, nextSequence);

        return log;
    });
}

module.exports = {
    appendAuditLog,
};