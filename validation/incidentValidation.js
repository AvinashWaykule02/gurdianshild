// Prefer Prisma enums when available, otherwise fall back to hard-coded lists
let validStatuses = ["OPEN", "UNDER_REVIEW", "APPROVED", "REJECTED", "REPAIRING", "RESOLVED"];
let validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

try {
    const { IncidentStatus, IncidentSeverity } = require("@prisma/client");
    if (IncidentStatus) validStatuses = Object.values(IncidentStatus);
    if (IncidentSeverity) validSeverities = Object.values(IncidentSeverity);
} catch (err) {
    // @prisma/client might not be generated or available in some environments — fall back to defaults
}

function parsePositiveInt(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeInt(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function buildIncidentQueryFilters(query) {
    const filters = {};

    if (query.userId) {
        const userId = parsePositiveInt(query.userId);
        if (!userId) {
            throw new Error("userId must be a positive integer");
        }
        filters.userId = userId;
    }

    if (query.status) {
        if (!validStatuses.includes(query.status)) {
            throw new Error(`Invalid status. Valid values: ${validStatuses.join(", ")}`);
        }
        filters.status = query.status;
    }

    if (query.severity) {
        if (!validSeverities.includes(query.severity)) {
            throw new Error(`Invalid severity. Valid values: ${validSeverities.join(", ")}`);
        }
        filters.severity = query.severity;
    }

    if (Object.prototype.hasOwnProperty.call(query, "limit")) {
        const limit = parsePositiveInt(query.limit);
        if (!limit) {
            throw new Error("limit must be a positive integer");
        }
        filters.limit = Math.min(limit, 200);
    }

    if (Object.prototype.hasOwnProperty.call(query, "skip")) {
        const skip = parseNonNegativeInt(query.skip);
        if (skip === null) {
            throw new Error("skip must be a non-negative integer");
        }
        filters.skip = skip;
    }

    return filters;
}

function validateIncidentStatus(status) {
    if (!status) {
        throw new Error("Status is required");
    }

    if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Valid values: ${validStatuses.join(", ")}`);
    }

    return status;
}

module.exports = {
    buildIncidentQueryFilters,
    validateIncidentStatus,
};
