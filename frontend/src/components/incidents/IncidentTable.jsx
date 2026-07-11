import Card from '../ui/Card';
import Badge from '../ui/Badge';

const statusTone = {
    OPEN: 'warning',
    UNDER_REVIEW: 'info',
    APPROVED: 'success',
    REJECTED: 'danger',
    REPAIRING: 'warning',
    RESOLVED: 'success',
};

export default function IncidentTable({ incidents, loading, selectedId, onSelect, canApprove }) {
    if (loading) {
        return <Card title="Incidents" subtitle="Loading incidents…" />;
    }

    return (
        <Card title="Incidents" subtitle="Latest security incidents and approvals">
            <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-surface-700/70 text-left text-xs uppercase tracking-wider text-gray-400">
                        <tr>
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Title</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Severity</th>
                            <th className="px-4 py-3">Created</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-surface-800/40">
                        {incidents.length === 0 ? (
                            <tr>
                                <td className="px-4 py-6 text-center text-gray-400" colSpan="5">
                                    No incidents found.
                                </td>
                            </tr>
                        ) : (
                            incidents.map((incident) => (
                                <tr
                                    key={incident.incidentId || incident.id}
                                    onClick={() => onSelect?.(incident)}
                                    className={`cursor-pointer hover:bg-white/5 ${selectedId === (incident.incidentId || incident.id) ? 'bg-shield-600/10' : ''}`}
                                >
                                    <td className="px-4 py-3 text-gray-300">#{incident.incidentId || incident.id}</td>
                                    <td className="px-4 py-3 text-gray-200">{incident.title || 'Security incident'}</td>
                                    <td className="px-4 py-3">
                                        <Badge tone={statusTone[incident.status] || 'neutral'}>{incident.status}</Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge tone={incident.severity === 'HIGH' || incident.severity === 'CRITICAL' ? 'danger' : 'warning'}>{incident.severity}</Badge>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{new Date(incident.createdAt).toLocaleString()}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {canApprove && <p className="mt-3 text-xs text-gray-500">Approve or reject incidents from the detail card.</p>}
        </Card>
    );
}
