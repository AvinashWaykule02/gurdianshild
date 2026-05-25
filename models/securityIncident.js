const mongoose = require('mongoose');

const securityIncidentSchema = new mongoose.Schema(
  {
    affectedUser:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    affectedTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
    expectedHash:        { type: String, required: true }, // stored hash in DB
    recalculatedHash:    { type: String, required: true }, // freshly computed hash
    detectedAt:          { type: Date, default: Date.now },
    severity:            { type: String, default: 'CRITICAL' },
    securityLogId:       { type: mongoose.Schema.Types.ObjectId, ref: 'SecurityLog' },
  },
  { timestamps: false }
);

module.exports = mongoose.model('SecurityIncident', securityIncidentSchema);