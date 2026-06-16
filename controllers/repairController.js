const repairQueue = require("../queues/repairQueue");
const incidentRepository = require("../repositories/incidentRepository");
const { emit, EVENTS } = require("../services/socketEventService");

async function triggerRepair(req, res) {
    try {
        const { incidentId } = req.body;
        const incident = await incidentRepository.findIncidentById(incidentId);

        if (!incident) {
            return res.status(404).json({ success: false, message: "Incident not found" });
        }


        if (incident.status !== "APPROVED") {
            return res.status(400).json({ success: false, message: "Incident must be APPROVED before repair" });
        }

        await repairQueue.add("repair-incident", { incidentId: Number(incidentId) });

        emit(EVENTS.REPAIR_STARTED, {
            userId: incident.userId,
            message: "Repair job queued",
            meta: { incidentId: Number(incidentId), status: "QUEUED" },
        });

        return res.status(202).json({ success: true, message: "Repair job queued", incidentId });
    } catch (err) {
        console.error("triggerRepair error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    triggerRepair,
};
