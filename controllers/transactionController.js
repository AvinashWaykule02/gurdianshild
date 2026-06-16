const prisma = require("../config/prisma");
const {
  createTransaction,
  getTransactions,
  getTransactionById,
} = require('../services/transactionService');
const { emit, EVENTS } = require('../services/socketEventService');


//---------------------------------------------------------------
// CREATE TRANSACTION CONTROLLER
//---------------------------------------------------------------
async function createTransactionHandler(req, res) {
  try {

    // ✅ AUTH CHECK
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { amount, description, type } = req.body;


    // ❌ BASIC VALIDATION (important for production)
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required and must be a positive number'
      });
    }

    // ✅ SERVICE CALL (DB + ACID + HASH + LOG)
    const { transaction, outboxEvent } = await createTransaction(userId, {
      amount: Number(amount),
      description,
      type: type?.toUpperCase(),
    });

    emit(EVENTS.TRANSACTION_CREATED, {
      userId,
      message: "Transaction created",
      meta: {
        transactionId: transaction.id,
        amount: Number(amount),
        description,
        outboxStatus: outboxEvent.status,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Transaction created. Outbox event queued for processing.",
      data: {
        transaction,
        outbox: {
          id: String(outboxEvent.id),
          status: outboxEvent.status,
        },
      },
    });

  } catch (err) {
    console.error('createTransaction error:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
}


//---------------------------------------------------------------
// GET ALL TRANSACTIONS CONTROLLER
//---------------------------------------------------------------
async function getAllTransactions(req, res) {
  try {

    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const transactions = await getTransactions(userId);

    return res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });

  } catch (err) {
    console.error('getTransactions error:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
}

//---------------------------------------------------------------
// GET TRANSACTION BY ID CONTROLLER
//---------------------------------------------------------------
async function getTransactionByIdHandler(req, res) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { id } = req.params;
    const transaction = await getTransactionById(id);

    if (transaction.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: not your transaction'
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    console.error('getTransactionById error:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
}

//---------------------------------------------------------------
// EXPORT CONTROLLERS
//---------------------------------------------------------------
module.exports = {
  createTransactionHandler,
  getAllTransactions,
  getTransactionById: getTransactionByIdHandler
};