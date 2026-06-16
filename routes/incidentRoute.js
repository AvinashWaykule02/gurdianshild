const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
    getAllIncidents,
    getIncidentById,
    updateIncidentStatus,
} = require("../controllers/incidentController");

// INCIDENT ROUTES
router.get("/", authMiddleware, getAllIncidents);
router.get("/:id", authMiddleware, getIncidentById);
router.patch("/:id/status", authMiddleware, updateIncidentStatus);

module.exports = router;
