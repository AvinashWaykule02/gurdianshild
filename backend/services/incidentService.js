const incidentRepository = require("../repositories/incidentRepository");

async function listIncidents(options = {}) {
    return incidentRepository.findIncidents(options);
}

async function getIncidentById(incidentId) {
    return incidentRepository.findIncidentById(incidentId);
}

async function changeIncidentStatus(incidentId, status, resolverId) {
    return incidentRepository.updateIncidentStatus(incidentId, status, resolverId);
}

module.exports = {
    listIncidents,
    getIncidentById,
    changeIncidentStatus,
};
