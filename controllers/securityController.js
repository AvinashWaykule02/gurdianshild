const { verifyUserHashChain } = require('../algorithams/verifyHashchain');
const SecurityIncident = require('../models/securityIncident');

async function verifyIntegrity(req, res) {
  try {
    const userId = req.query.userId || req.user?._id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await verifyUserHashChain(userId);

    res.json({
      userId,
      integrity: result.valid ? 'VERIFIED' : 'COMPROMISED',
      totalChecked: result.totalChecked,
      incidents: result.incidents,
    });
  } catch (err) {
    console.error('verifyIntegrity error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getIncidents(req, res) {
  try {
    const userId = req.query.userId;
    const query  = userId ? { affectedUser: userId } : {};
    const incidents = await SecurityIncident.find(query)
      .populate('affectedUser', 'name email')
      .populate('affectedTransaction')
      .sort({ detectedAt: -1 });
    res.json({ incidents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { verifyIntegrity, getIncidents };