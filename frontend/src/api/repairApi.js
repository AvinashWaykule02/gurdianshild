import api from './axios';

// Backend contract: repairController.js -> POST /api/repair/user
export const repairApi = {
    /** Trigger per-user repair. Backend finds latest APPROVED incident automatically. */
    triggerForUser: (userId) => api.post('/api/repair/user', { userId }),
};
