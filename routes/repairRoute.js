const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const rbacMiddleware = require("../middleware/rbacMiddleware");
const { triggerRepair } = require("../controllers/repairController");

router.post(
    "/incident", 
    authMiddleware, 
    rbacMiddleware(["SENIOR_MANAGER", "SUPER_ADMIN"]), 
    triggerRepair
);

module.exports = router;
