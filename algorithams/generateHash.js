const crypto = require('crypto');



/*
|--------------------------------------------------------------------------
| Generate Secure Hash
|--------------------------------------------------------------------------
| This hash is generated using:
|
| 1. Transaction snapshot data
| 2. Previous transaction hash
| 3. Timestamp
|
| This creates a blockchain-like chain.
|--------------------------------------------------------------------------
*/

function generateHash(
  transactionData,
  previousHash,
  timestamp
) {

  //Create Payload Object
  const payload = {   
    transactionData,  // Immutable transaction snapshot   
    previousHash: previousHash || 'GENESIS',  // Previous chain hash
    timestamp: new Date(timestamp).toISOString(),  // Standardized timestamp
  };
  // Convert Object To String
  const payloadString = JSON.stringify(payload);

  //Generate SHA-256 Hash
  const hash = crypto
    .createHash('sha256')
    .update(payloadString)
    .digest('hex');

  //  Return Final Hash
  return hash;
}

module.exports = {  generateHash};
 