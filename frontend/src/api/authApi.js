import api from './axios';

// Backend contract: authController.js -> /api/auth/*
export const authApi = {
    login: (email, password) => api.post('/api/auth/login', { email, password }),
    signup: (name, email, password) => api.post('/api/auth/signup', { name, email, password }),
    logout: () => api.post('/api/auth/logout'),
    profile: () => api.get('/api/auth/profile'),
};
