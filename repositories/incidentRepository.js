const prisma = require("../config/prisma");

async function findIncidents({ userId, status, severity, limit = 100, skip = 0 } = {}) {
    const where = {};

    if (userId !== undefined && userId !== null) {
        where.userId = Number(userId);
    }

    if (status) {
        where.status = status;
    }

    if (severity) {
        where.severity = severity;
    }

    return prisma.incident.findMany({
        where,
        orderBy: {
            createdAt: "desc",
        },
        take: Number(limit),
        skip: Number(skip),
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            resolver: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            verificationRun: true,
        },
    });
}

async function findIncidentById(id) {
    return prisma.incident.findUnique({
        where: {
            id: Number(id),
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            resolver: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            verificationRun: true,
        },
    });
}

async function updateIncidentStatus(incidentId, status, resolverId) {
    const data = {
        status,
    };

    if (["APPROVED", "REJECTED", "RESOLVED"].includes(status)) {
        data.resolvedBy = resolverId || null;
        data.resolvedAt = new Date();
    } else {
        data.resolvedBy = null;
        data.resolvedAt = null;
    }

    return prisma.incident.update({
        where: {
            id: Number(incidentId),
        },
        data,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            resolver: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            verificationRun: true,
        },
    });
}

module.exports = {
    findIncidents,
    findIncidentById,
    updateIncidentStatus,
};
