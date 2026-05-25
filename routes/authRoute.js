const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { signup, login, logout, profile } = require("../controllers/authController");

// Register Route
router.post("/signup", signup);
// Login Route
router.post("/login", login);
// Logout Route
router.post("/logout", logout);
// Profile Route
router.get("/profile", authMiddleware, profile);



module.exports = router;