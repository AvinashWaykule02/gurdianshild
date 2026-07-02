const {
    listIncidents,
    getIncidentById,
    changeIncidentStatus,
} = require("../services/incidentService");
const { emit, EVENTS } = require("../services/socketEventService");
const {
    buildIncidentQueryFilters,
    validateIncidentStatus,
} = require("../validation/incidentValidation");

function formatIncidentResponse(record) {
    if (!record) {
        return null;
    }

    const { id, ...rest } = record;
    return {
        incidentId: id,
        ...rest,
    };
}

async function getAllIncidents(req, res) {
    try {
        const filters = buildIncidentQueryFilters(req.query);

        const allowedRoles = ["SENIOR_MANAGER", "SUPER_ADMIN"];
        if (!allowedRoles.includes(req.user?.role)) {
            filters.userId = req.user?.userId;
        }

        const incidents = await listIncidents(filters);

        return res.status(200).json({
            success: true,
            count: incidents.length,
            data: incidents.map(formatIncidentResponse),
        });
    } catch (err) {
        console.error("getAllIncidents error:", err);

        return res.status(err.message?.includes("Invalid") || err.message?.includes("required") ? 400 : 500).json({
            success: false,
            message: err.message,
        });
    }
}

async function getIncidentByIdHandler(req, res) {
    try {
        const { id } = req.params;
        const incident = await getIncidentById(id);

        if (!incident) {
            return res.status(404).json({
                success: false,
                message: `Incident not found for id: ${id}`,
            });
        }

        const allowedRoles = ["SENIOR_MANAGER", "SUPER_ADMIN"];
        if (!allowedRoles.includes(req.user?.role) && incident.userId !== req.user?.userId) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: cannot access incident for another user",
            });
        }

        return res.status(200).json({
            success: true,
            data: formatIncidentResponse(incident),
        });
    } catch (err) {
        console.error("getIncidentById error:", err);

        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

async function updateIncidentStatusHandler(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        validateIncidentStatus(status);

        const incident = await getIncidentById(id);
        if (!incident) {
            return res.status(404).json({
                success: false,
                message: `Incident not found for id: ${id}`,
            });
        }

        const allowedRoles = ["SENIOR_MANAGER", "SUPER_ADMIN"];
        if (!allowedRoles.includes(req.user?.role) && incident.userId !== req.user?.userId) {
            return res.status(403).json({
                success: false,
                message: "Forbidden: cannot update incident status for another user",
            });
        }

        const updatedIncident = await changeIncidentStatus(id, status, req.user?.userId);

        emit(EVENTS.INCIDENT_UPDATED, {
            userId: updatedIncident.userId,
            severity: updatedIncident.severity,
            message: `Incident status changed to ${status}`,
            meta: { incidentId: Number(id), status },
        });

        return res.status(200).json({
            success: true,
            message: "Incident status updated successfully",
            data: formatIncidentResponse(updatedIncident),
        });
    } catch (err) {
        console.error("updateIncidentStatus error:", err);

        return res.status(err.message?.includes("Invalid") || err.message?.includes("required") ? 400 : 500).json({
            success: false,
            message: err.message,
        });
    }
}

module.exports = {
    getAllIncidents,
    getIncidentById: getIncidentByIdHandler,
    updateIncidentStatus: updateIncidentStatusHandler,
};
