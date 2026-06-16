const prisma = require("../config/prisma");

const ledgerMiddleware = async (req, res, next) => {
    try {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const ledgerState = await prisma.ledgerState.findUnique({
            where: { userId: req.user.userId }
        });

        // If no ledger state exists, we assume it's ACTIVE for backwards compatibility.
        // Or it will be created on the fly if needed.
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
