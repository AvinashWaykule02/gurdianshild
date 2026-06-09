// services/transactionService.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/*
|--------------------------------------------------------------------------
| CREATE TRANSACTION + OUTBOX EVENT (ATOMIC)
|--------------------------------------------------------------------------
| 1. Create Transaction
| 2. Create AuditOutbox record
|--------------------------------------------------------------------------
*/
async function createTransaction(
  userId,
  {
    amount,
    description,
  }
) {

  // Validation
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!amount || amount <= 0) {
    throw new Error("Invalid amount");
  }

  if (!description) {
    throw new Error("Description is required");
  }

  return await prisma.$transaction(async (tx) => {

    // 1. Create transaction
    const transaction = await tx.transaction.create({
      data: {
        userId,
        amount,
        description,
      },
    });

    // 2. Create outbox event
    const outboxEvent = await tx.auditOutbox.create({
      data: {
        transactionId: transaction.id,
        payload: transaction,
        status: "PENDING",
      },
    });

    return {
      transaction,
      outboxEvent,
    };
  });
}

/*
|--------------------------------------------------------------------------
| GET TRANSACTION BY ID
|--------------------------------------------------------------------------
*/
async function getTransactionById(id) {

  const transaction = await prisma.transaction.findUnique({
    where: {
      id: Number(id),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  return transaction;
}

async function getTransactions(userId) {
  return prisma.transaction.findMany({
    where: {
      userId: Number(userId),
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
};