import Badge from '../ui/Badge';
import Card from '../ui/Card';

const severityTone = {
    INFO: 'neutral',
    WARNING: 'warning',
    ERROR: 'danger',
    CRITICAL: 'danger',
};

export default function EventFeed({ events = [] }) {
    return (
        <Card title="Live event feed" subtitle="Socket.IO events from the backend">
            <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
                {events.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-gray-500">
                        Waiting for backend events…
                    </div>
                ) : (
                    events.map((event) => (
                        <div key={event.id} className="rounded-xl border border-white/10 bg-surface-700/60 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-white">{event.event || event.name}</span>
                                    <Badge tone={severityTone[event.severity] || 'info'}>{event.severity || 'INFO'}</Badge>
                                </div>
                                <span className="text-xs text-gray-500">{new Date(event.timestamp || event.createdAt || Date.now()).toLocaleTimeString()}</span>
                            </div>
                            <p className="mb-2 text-sm text-gray-400">{event.message || 'No message'}</p>
                            <pre className="overflow-x-auto text-xs text-gray-500">
                                {JSON.stringify(event.meta || event.payload || {}, null, 2)}
                            </pre>
                        </div>
                    ))
                )}
            </div>
        </Card>
    );
}
