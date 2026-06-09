const express = require('express');
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  createTransactionHandler,
  getAllTransactions,
  getTransactionById,
} = require('../controllers/transactionController');


//----------------------------------------------------
// TRANSACTION ROUTES (PROTECTED)
//----------------------------------------------------

// Create a new transaction
router.post(
  '/create',
  authMiddleware,
  createTransactionHandler
);

// Get transaction by id
router.get("/:id", authMiddleware, getTransactionById);

module.exports = router;