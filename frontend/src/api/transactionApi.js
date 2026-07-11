import api from './axios';

// Backend contract: transactionController.js -> /api/transaction/*
export const transactionApi = {
    create: (payload) => api.post('/api/transaction/create', payload),
    list: () => api.get('/api/transaction'),
    getById: (id) => api.get(`/api/transaction/${id}`),
};
