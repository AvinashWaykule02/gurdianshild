import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
    const { token } = useAuth();
    const [socket, setSocket] = useState(null);
    const [events, setEvents] = useState([]);

    useEffect(() => {
        if (!token) {
            setSocket(null);
            setEvents([]);
            return;
        }

        const client = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
            auth: { token },
            transports: ['websocket', 'polling'],
        });

        const handleEvent = (payload) => {
            const eventWithId = {
                id: `${payload.event || 'event'}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                ...payload,
            };
            setEvents((prev) => [eventWithId, ...prev].slice(0, 50));
        };

        const allEvents = [
            'TRANSACTION_CREATED',
            'AUDIT_COMPLETE',
            'VERIFICATION_STARTED',
            'VERIFICATION_OK',
            'TAMPER_DETECTED',
            'INCIDENT_CREATED',
            'INCIDENT_UPDATED',
            'LEDGER_LOCKED',
            'LEDGER_UNLOCKED',
            'REPAIR_STARTED',
            'REPAIR_COMPLETED',
        ];

        allEvents.forEach((eventName) => client.on(eventName, handleEvent));

        setSocket(client);

        return () => {
            allEvents.forEach((eventName) => client.off(eventName, handleEvent));
            client.disconnect();
            setSocket(null);
        };
    }, [token]);

    const value = useMemo(
        () => ({ socket, events }),
        [socket, events],
    );

    return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocketEvents() {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error('useSocketEvents must be used inside <SocketProvider>');
    return ctx;
}
