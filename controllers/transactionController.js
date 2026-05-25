const {
  createTransaction,
  getTransactions
} = require('../services/transactionService');


//---------------------------------------------------------------
// Create New Transaction
async function createTransactionHandler(req, res) {
  try {

   
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    const {
      amount,
      type,
      description,
      metadata
    } = req.body;

    // Call service layer
    const result = await createTransaction(userId, {
      amount,
      type,
      description,
      metadata
    });

    return res.status(201).json({
      message: 'Transaction created',
      transaction: result.transaction,
      auditHash: result.currentHash,
    });

  } catch (err) {
    console.error('createTransaction error:', err);

    return res.status(500).json({
      error: err.message
    });
  }
}


//---------------------------------------------------------------
// Get All Transactions
async function getAllTransactions(req, res) {
  try {

   
    const userId = req.user.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized'
      });
    }

    const transactions = await getTransactions(userId);

    return res.status(200).json({
      transactions
    });

  } catch (err) {
    console.error('getTransactions error:', err);

    return res.status(500).json({
      error: err.message
    });
  }
}


// Export controllers
module.exports = {
  createTransactionHandler,
  getAllTransactions
};