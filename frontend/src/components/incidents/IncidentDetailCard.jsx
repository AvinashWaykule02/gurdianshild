import { useState } from 'react';
import { incidentApi } from '../../api/incidentApi';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

export default function IncidentDetailCard({ incident, canApprove, onUpdated }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!incident) {
        return (
            <Card title="Selected incident" subtitle="Choose an incident row to inspect it">
                <p className="text-sm text-gray-400">No incident selected.</p>
            </Card>
        );
    }

    const submitStatus = async (status) => {
        setError('');
        setLoading(true);
        try {
            await incidentApi.updateStatus(incident.incidentId || incident.id, status);
            if (onUpdated) onUpdated();
        } catch (err) {
            setError(err.response?.data?.message || 'Could not update incident');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title={`Incident #${incident.incidentId || incident.id}`} subtitle="Status updates flow through the backend incident controller">
            <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status</span>
                    <Badge tone={incident.status === 'APPROVED' ? 'success' : incident.status === 'REJECTED' ? 'danger' : 'warning'}>{incident.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-gray-400">Severity</span>
                    <Badge tone={incident.severity === 'HIGH' || incident.severity === 'CRITICAL' ? 'danger' : 'warning'}>{incident.severity}</Badge>
                </div>
                <div>
                    <span className="text-gray-400">Title</span>
                    <p className="mt-1 text-white">{incident.title || 'Security incident'}</p>
                </div>
                <div>
                    <span className="text-gray-400">Description</span>
                    <p className="mt-1 text-gray-400">{incident.description || 'No description provided.'}</p>
                </div>
                <div>
                    <span className="text-gray-400">Detected by</span>
                    <p className="mt-1 text-gray-400">{incident.detectedBy || 'VERIFICATION_ENGINE'}</p>
                </div>
            </div>
            {canApprove && (
                <div className="mt-4 flex gap-2">
                    <Button variant="secondary" onClick={() => submitStatus('APPROVED')} disabled={loading}>
                        {loading ? 'Working…' : 'Approve'}
                    </Button>
                    <Button variant="danger" onClick={() => submitStatus('REJECTED')} disabled={loading}>
                        {loading ? 'Working…' : 'Reject'}
                    </Button>
                </div>
            )}
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </Card>
    );
}
