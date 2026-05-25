const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(

  {
   
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

  
    amount: {
      type: Number,
      required: true
    },

    // credit  -> money added
    // debit   -> money deducted
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    },

    description: {
      type: String,
      default: ''
    },

    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
  },

  // Automatically creates:
  // createdAt
  // updatedAt
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);