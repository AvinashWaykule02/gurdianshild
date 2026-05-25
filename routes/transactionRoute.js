const express = require('express');
const router  = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  createTransactionHandler,
  getAllTransactions,
} = require('../controllers/transactionController');

// POST /transaction/create
router.post('/create', authMiddleware, createTransactionHandler);

// GET  /transaction/all?userId=xxx
router.get('/all', authMiddleware, getAllTransactions);

module.exports = router;