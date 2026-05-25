const mongoose = require('mongoose');

const Transaction = require('../models/transaction');
const SecurityLog = require('../models/securityLogs');

const { generateHash } = require('../algorithams/generateHash');



/*
|--------------------------------------------------------------------------
| Create Secure Transaction
|--------------------------------------------------------------------------
| Steps:
| 1. Start MongoDB transaction
| 2. Save transaction
| 3. Get previous hash
| 4. Create snapshot
| 5. Generate current hash
| 6. Save security log
| 7. Commit transaction
|--------------------------------------------------------------------------
*/

async function createTransaction(userId, payload) {

  // Start MongoDB session
  const session = await mongoose.startSession();

  // Start ACID transaction
  session.startTransaction();


  try {

    /*
    |--------------------------------------------------------------------------
    | STEP 1 → Create Transaction
    |--------------------------------------------------------------------------
    */

    const [transaction] = await Transaction.create(

      [
        {
          userId,

          ...payload,

          status: 'completed'
        }
      ],

      { session }
    );



    /*
    |--------------------------------------------------------------------------
    | STEP 2 → Get Latest User Security Log
    |--------------------------------------------------------------------------
    */

    const latestLog = await SecurityLog

      .findOne({ userId })

      .sort({ _id: -1 })

      .select('currentHash')

      .session(session);



    /*
    |--------------------------------------------------------------------------
    | STEP 3 → Get Previous Hash
    |--------------------------------------------------------------------------
    */

    const previousHash = latestLog
      ? latestLog.currentHash
      : null;



    /*
    |--------------------------------------------------------------------------
    | STEP 4 → Create Immutable Transaction Snapshot
    |--------------------------------------------------------------------------
    */

    const transactionSnapshot = {

      _id: transaction._id.toString(),

      userId: transaction.userId.toString(),

      amount: transaction.amount,

      type: transaction.type,

      description: transaction.description,

      status: transaction.status,

      createdAt: transaction.createdAt,
    };



    /*
    |--------------------------------------------------------------------------
    | STEP 5 → Generate Current Hash
    |--------------------------------------------------------------------------
    */

    const timestamp = new Date();

    const currentHash = generateHash(

      transactionSnapshot,

      previousHash,

      timestamp
    );



    /*
    |--------------------------------------------------------------------------
    | STEP 6 → Save Security Audit Log
    |--------------------------------------------------------------------------
    */

    await SecurityLog.create(

      [
        {
          userId,

          transactionId: transaction._id,

          transactionData: transactionSnapshot,

          currentHash,

          previousHash,

          timestamp,
        },
      ],

      { session }
    );



    /*
    |--------------------------------------------------------------------------
    | STEP 7 → Commit Database Transaction
    |--------------------------------------------------------------------------
    */

    await session.commitTransaction();



    /*
    |--------------------------------------------------------------------------
    | Close Session
    |--------------------------------------------------------------------------
    */

    session.endSession();



    /*
    |--------------------------------------------------------------------------
    | Return Final Result
    |--------------------------------------------------------------------------
    */

    return {

      transaction,

      currentHash,

      previousHash
    };

  }

  catch (err) {

    /*
    |--------------------------------------------------------------------------
    | Rollback All Changes If Error Occurs
    |--------------------------------------------------------------------------
    */

    await session.abortTransaction();


    /*
    |--------------------------------------------------------------------------
    | Close Session
    |--------------------------------------------------------------------------
    */

    session.endSession();


    // Send error to controller
    throw err;
  }
}




/*
|--------------------------------------------------------------------------
| Get All Transactions Of User
|--------------------------------------------------------------------------
*/

async function getTransactions(userId) {

  return Transaction

    .find({ userId })

    .sort({ createdAt: -1 });
}




/*
|--------------------------------------------------------------------------
| Export Functions
|--------------------------------------------------------------------------
*/

module.exports = {

  createTransaction,

  getTransactions
};