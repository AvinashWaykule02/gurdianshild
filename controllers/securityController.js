const prisma = require("../config/prisma");
const { verifyUserHashChain } = require("../algorithams/verifyHashchain");

/**
 * VERIFY HASH CHAIN INTEGRITY
 */
async function verifyIntegrity(req, res) {
  try {
    const userId = req.query.userId || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const result = await verifyUserHashChain(Number(userId));

    return res.status(200).json({
      success: true,
      userId: Number(userId),
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
    const userId = req.query.userId;

    const incidents = await prisma.securityLog.findMany({
      where: userId
        ? {
            transaction: {
              userId: Number(userId),
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