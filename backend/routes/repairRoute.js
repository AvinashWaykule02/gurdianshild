const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const rbacMiddleware = require("../middleware/rbacMiddleware");
const { triggerRepair } = require("../controllers/repairController");

// POST /api/repair/user — queue a per-user chain repair
// Body: { userId }
// Roles: SENIOR_MANAGER, SUPER_ADMIN
router.post(
    "/user",
    authMiddleware,
    rbacMiddleware(["SENIOR_MANAGER", "SUPER_ADMIN"]),
    triggerRepair
);

module.exports = router;