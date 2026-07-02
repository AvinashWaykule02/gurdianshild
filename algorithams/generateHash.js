const crypto = require("crypto");

// Normalize Data (Make hashing consistent)
// Ensures same logical data always produces same JSON structure.
// | Example:
// | { a:1, b:2 } === { b:2, a:1 }
function normalize(value) {
  // If value is primitive (string, number, null), return as-is
  if (value === null || typeof value !== "object") {
    return value;
  }

  // If array, normalize each item
  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  // Convert special objects (Date, Decimal, etc.) into plain JSON values
  if (typeof value.toJSON === "function") {
    return normalize(value.toJSON());
  }

  // Sort object keys to ensure deterministic order
  const sortedKeys = Object.keys(value).sort();
  const result = {};

  for (const key of sortedKeys) {
    result[key] = normalize(value[key]);
  }

  return result;
}


//  Generate Hash
//  Creates a SHA-256 hash for audit chain integrity.
function generateHash(transactionData, previousHash, timestamp) {
  const payload = {
    transactionData: normalize(transactionData),
    previousHash: previousHash || "GENESIS",

    // If timestamp not provided, use current time
    timestamp: new Date(timestamp ?? Date.now()).toISOString(),
  };

  // Convert payload → string → hash it using SHA-256
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

module.exports = {
  generateHash,
  normalize,
};


// algorithms/generateHash.js
//
// Creates a SHA-256 hash for each transaction in a chain.
// Each hash depends on:
// 1. Transaction data
// 2. Previous hash (chain link)
// 3. Timestamp
//
// This forms a tamper-evident audit chain (like a mini-blockchain).