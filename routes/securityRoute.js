const express = require('express');
const router  = express.Router();
const {
  verifyIntegrity,
  getIncidents,
} = require('../controllers/securityController');

// GET /security/verify?userId=xxx  — run full hash chain check
router.get('/verify', verifyIntegrity);

// GET /security/incidents?userId=xxx — list all incidents
router.get('/incidents', getIncidents);

module.exports = router;