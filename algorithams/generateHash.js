const crypto = require("crypto");

/*
|--------------------------------------------------------------------------
| Generate Secure Audit Hash (Chain-based integrity)
|--------------------------------------------------------------------------
| Ensures:
| - deterministic hashing
| - stable object ordering
| - chain linking via previousHash
|--------------------------------------------------------------------------
*/

/**
 * Deep normalize object for consistent hashing
 */
function normalize(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (typeof value.toJSON === "function") {
    return normalize(value.toJSON());
  }

  const sortedKeys = Object.keys(value).sort();
  const result = {};

  for (const key of sortedKeys) {
    result[key] = normalize(value[key]);
  }

  return result;
}

/**
 * Generate SHA-256 hash for audit chain
 */
function generateHash(transactionData, previousHash, timestamp) {
  const payload = {
    transactionData: normalize(transactionData),
    previousHash: previousHash || "GENESIS",
    timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

module.exports = { generateHash };