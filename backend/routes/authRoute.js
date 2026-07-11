const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
  signup,
  login,
  logout,
  profile
} = require("../controllers/authController");


//----------------------------------------------------
// AUTH ROUTES
//----------------------------------------------------

// Register new user
router.post("/signup", signup);

// Login user
router.post("/login", login);

// Logout user (must be authenticated)
router.post("/logout", authMiddleware, logout);

// Get user profile (protected route)
router.get("/profile", authMiddleware, profile);

module.exports = router;