const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
  verifyIntegrity,
  getIncidents,
} = require("../controllers/securityController");

/*
|--------------------------------------------------------------------------
| SECURITY ROUTES
|--------------------------------------------------------------------------
| All routes are protected and related to audit + integrity system
|--------------------------------------------------------------------------
*/

/**
 * FULL HASH CHAIN VERIFICATION
 */
router.get("/verify", authMiddleware, verifyIntegrity);

/**
 * SECURITY / AUDIT INCIDENTS
 */
router.get("/incidents", authMiddleware, getIncidents);

module.exports = router;