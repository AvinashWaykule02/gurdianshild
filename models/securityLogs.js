const mongoose = require('mongoose');

// Security Audit Log Structure
const securityLogSchema = new mongoose.Schema(

  {
    // Which user owns this log
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // Related transaction
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true
    },

    // What action happened
    action: {
      type: String,
      default: 'TRANSACTION_CREATED'
    },

    // Full snapshot of transaction data
    // Stored for tamper detection
    transactionData: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },

    // Current log hash
    currentHash: {
      type: String,
      required: true,
      immutable: true
    },

    // Previous log hash in chain
    // null for first transaction
    previousHash: {
      type: String,
      default: null,
      immutable: true
    },

    // Time when log created
    timestamp: {
      type: Date,
      default: Date.now,
      immutable: true

    },
  },

  // We already maintain custom timestamp
  {
    timestamps: false
  }
);


// Fast search for user's chain
securityLogSchema.index({
  userId: 1,
  _id: 1
});


// Create SecurityLog collection/model
module.exports = mongoose.model('SecurityLog', securityLogSchema);