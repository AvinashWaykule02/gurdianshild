const prisma = require("../config/prisma");
const { verifyUserHashChain } = require("../algorithams/verifyHashchain");

const PRIVILEGED_ROLES = ["SENIOR_MANAGER", "SUPER_ADMIN"];


function resolveScopedUserId(req, { required }) {
    const role = req.user?.role;
    const isPrivileged = PRIVILEGED_ROLES.includes(role);

    if (!req.user?.userId && !isPrivileged) {
        return { error: { status: 401, message: "Unauthorized" } };
    }

    let rawUserId;
    if (isPrivileged) {
        // Privileged callers may target any user via the query param.
        rawUserId = req.query.userId;
    } else {
        // Non-privileged callers are always scoped to themselves —
        // req.query.userId is intentionally never consulted here.
        rawUserId = req.user.userId;
    }

    if (rawUserId === undefined || rawUserId === null || rawUserId === "") {
        if (required) {
            return { error: { status: 400, message: "userId is required" } };
        }
        return { userId: null }; // null => caller (privileged) wants "all users"
    }

    if (isNaN(Number(rawUserId))) {
        return { error: { status: 400, message: "userId must be a number" } };
    }

    return { userId: Number(rawUserId) };
}

/**
 * VERIFY HASH CHAIN INTEGRITY
 */
async function verifyIntegrity(req, res) {
    try {
        const { userId, error } = resolveScopedUserId(req, { required: true });
        if (error) {
            return res.status(error.status).json({ success: false, message: error.message });
        }

        const result = await verifyUserHashChain(userId);

        return res.status(200).json({
            success: true,
            userId,
            integrity: result.valid ? "VERIFIED" : "COMPROMISED",
            totalChecked: result.totalChecked,
            incidents: result.incidents,
        });
    } catch (err) {
        console.error("verifyIntegrity error:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

/**
 * GET SECURITY INCIDENTS (AUDIT LOG VIEW)
 */
async function getIncidents(req, res) {
    try {
       
        const { userId, error } = resolveScopedUserId(req, { required: false });
        if (error) {
            return res.status(error.status).json({ success: false, message: error.message });
        }

        const incidents = await prisma.securityLog.findMany({
            where: userId
                ? {
                      transaction: {
                          userId,
                      },
                  }
                : {},
            orderBy: {
                createdAt: "desc",
            },
            include: {
                transaction: {
                    select: {
                        id: true,
                        userId: true,
                        amount: true,
                        description: true,
                        createdAt: true,
                    },
                },
            },
        });

        return res.status(200).json({
            success: true,
            count: incidents.length,
            incidents,
        });
    } catch (err) {
        console.error("getIncidents error:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

module.exports = {
    verifyIntegrity,
    getIncidents,
};