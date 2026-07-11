import api from './axios';

// Backend contract: securityController.js -> /api/security/verify
// The backend resolves the caller's own userId from the authenticated session.
export const securityApi = {
    verify: (userId) => api.get('/api/security/verify', {
        params: userId ? { userId } : undefined,
    }),
};
