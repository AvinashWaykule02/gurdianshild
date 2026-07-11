import { useEffect, useState } from 'react';
import { incidentApi } from '../api/incidentApi';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import IncidentTable from '../components/incidents/IncidentTable';
import IncidentDetailCard from '../components/incidents/IncidentDetailCard';
import EventFeed from '../components/events/EventFeed';
import { useSocketEvents } from '../hooks/useSocketEvents';

export default function IncidentsPage() {
    const { user } = useAuth();
    const { events } = useSocketEvents();
    const [incidents, setIncidents] = useState([]);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadIncidents = async () => {
        setLoading(true);
        try {
            const { data } = await incidentApi.list();
            setIncidents(data?.data || []);
            if (!selectedIncident && (data?.data || []).length > 0) {
                setSelectedIncident(data.data[0]);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadIncidents();
    }, []);

    return (
        <div className="min-h-screen bg-surface-900">
            <Navbar />
            <main className="mx-auto max-w-7xl px-6 py-8">
                <div className="mb-6">
                    <p className="text-sm text-shield-400">Incidents</p>
                    <h2 className="text-2xl font-semibold text-white">Review security incidents</h2>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-6">
                        <IncidentTable
                            incidents={incidents}
                            loading={loading}
                            selectedId={selectedIncident?.incidentId || selectedIncident?.id}
                            onSelect={setSelectedIncident}
                            canApprove={user?.role === 'SUPER_ADMIN'}
                        />
                        <IncidentDetailCard
                            incident={selectedIncident}
                            canApprove={user?.role === 'SUPER_ADMIN'}
                            onUpdated={loadIncidents}
                        />
                    </div>
                    <EventFeed events={events} />
                </div>
            </main>
        </div>
    );
}
