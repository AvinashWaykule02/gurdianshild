import api from './axios';

// ---------------------------------------------------------------------------
// ADMIN API — centralised calls to /api/admin/*
// ---------------------------------------------------------------------------
export const adminApi = {
    /** Full overview: users, transactions, incidents, lockedUsers */
    overview: () => api.get('/api/admin/overview'),

    /** Per-user data */
    userTransactions: (userId) => api.get(`/api/admin/users/${userId}/transactions`),
    userIncidents: (userId) => api.get(`/api/admin/users/${userId}/incidents`),

    /**
     * Live LedgerState for a user.
     * Returns: { status, lockedAt, lockedReason, incidentId, incident }
     */
    ledgerStatus: (userId) => api.get(`/api/admin/users/${userId}/ledger-status`),

    /** Run hash-chain verification (triggers incident creation if corrupt) */
    verifyChain: (userId) => api.post(`/api/admin/users/${userId}/verify`),

    /**
     * Queue a chain repair for a user.
     * Backend automatically picks the latest APPROVED incident.
     */
    repairUser: (userId) => api.post(`/api/admin/users/${userId}/repair`),

    /**
     * Explicitly unlock a user's ledger AFTER repair is complete.
     * Only works when LedgerState.status === 'UNDER_REPAIR'.
     */
    unlockUser: (userId) => api.post(`/api/admin/users/${userId}/unlock`),
};
