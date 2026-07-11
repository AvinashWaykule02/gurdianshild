import { useSocketEvents as useSocketEventsContext } from '../context/SocketContext';

export function useSocketEvents() {
    return useSocketEventsContext();
}
