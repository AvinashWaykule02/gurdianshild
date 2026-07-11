const prisma = require("../config/prisma");

const ledgerMiddleware = async (req, res, next) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        // Convert JWT userId to Number for Prisma
        const userId = Number(req.user.userId);

        // Validate the converted userId
        if (Number.isNaN(userId)) {
            return res.status(401).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const ledgerState = await prisma.ledgerState.findUnique({
            where: { userId }
        });

        // If no ledger state exists, assume ACTIVE for backwards compatibility.
        if (ledgerState && ledgerState.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Ledger locked due to integrity incident",
                lockedReason: ledgerState.lockedReason,
                lockedAt: ledgerState.lockedAt
            });
        }

        next();
    } catch (err) {
        console.error("ledgerMiddleware error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error checking ledger status"
        });
    }
};

module.exports = ledgerMiddleware;