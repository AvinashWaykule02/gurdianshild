import api from './axios';

// Backend contract: incidentController.js -> /api/incidents/*
export const incidentApi = {
    list: () => api.get('/api/incidents'),
    getById: (id) => api.get(`/api/incidents/${id}`),
    updateStatus: (id, status) => api.patch(`/api/incidents/${id}/status`, { status }),
};
