const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const rbacMiddleware = require("../middleware/rbacMiddleware");
const {
    getAdminOverview,
    getAdminUserTransactions,
    getAdminUserIncidents,
    getUserLedgerStatus,
    verifyUserLedger,
    repairUserChain,
    unlockUserLedger,
} = require("../controllers/adminController");

// ---------------------------------------------------------------------------
// OVERVIEW
// ---------------------------------------------------------------------------
router.get(
    "/overview",
    authMiddleware,
    rbacMiddleware(["SUPER_ADMIN"]),
    getAdminOverview
);

// ---------------------------------------------------------------------------
// USER DETAIL
// ---------------------------------------------------------------------------
router.get(
    "/users/:userId/transactions",
    authMiddleware,
    rbacMiddleware(["SUPER_ADMIN"]),
    getAdminUserTransactions
);

router.get(
    "/users/:userId/incidents",
    authMiddleware,
    rbacMiddleware(["SUPER_ADMIN"]),
    getAdminUserIncidents
);

// GET live ledger state for a specific user
router.get(
    "/users/:userId/ledger-status",
    authMiddleware,
    rbacMiddleware(["SUPER_ADMIN", "SENIOR_MANAGER"]),
    getUserLedgerStatus
);

// ---------------------------------------------------------------------------
// CHAIN ACTIONS (SUPER_ADMIN only)
// ---------------------------------------------------------------------------

// Run hash-chain verification
router.post(
    "/users/:userId/verify",
    authMiddleware,
    rbacMiddleware(["SUPER_ADMIN"]),
    verifyUserLedger
);

// Queue a chain repair job for a user (picks latest APPROVED incident)
router.post(
    "/users/:userId/repair",
    authMiddleware,
    rbacMiddleware(["SUPER_ADMIN"]),
    repairUserChain
);

// Explicitly unlock the ledger AFTER repair is confirmed
router.post(
    "/users/:userId/unlock",
    authMiddleware,
    rbacMiddleware(["SUPER_ADMIN"]),
    unlockUserLedger
);

module.exports = router;
