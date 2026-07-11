import { useState } from 'react';
import { securityApi } from '../api/securityApi';
import { useSocketEvents } from '../hooks/useSocketEvents';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import EventFeed from '../components/events/EventFeed';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

export default function SecurityPage() {
    const { events } = useSocketEvents();
    const { user } = useAuth();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const verify = async () => {
        setError('');
        setLoading(true);
        try {
            const { data } = await securityApi.verify(user?.id ?? user?.userId);
            setResult(data);
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface-900">
            <Navbar />
            <main className="mx-auto max-w-7xl px-6 py-8">
                <div className="mb-6">
                    <p className="text-sm text-shield-400">Security</p>
                    <h2 className="text-2xl font-semibold text-white">Verify my ledger</h2>
                </div>

                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-6">
                        <Card title="Integrity verification" subtitle="Calls the backend verify endpoint and shows the result">
                            <div className="space-y-4">
                                <Button onClick={verify} disabled={loading} className="w-full">
                                    {loading ? 'Verifying…' : 'Verify my ledger'}
                                </Button>
                                {error && <p className="text-sm text-red-400">{error}</p>}
                                {result && (
                                    <div className={`rounded-2xl border p-4 ${result.integrity === 'VERIFIED' ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'}`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-gray-400">Result</p>
                                                <p className="text-xl font-semibold text-white">{result.integrity}</p>
                                            </div>
                                            <Badge tone={result.integrity === 'VERIFIED' ? 'success' : 'danger'}>{result.integrity}</Badge>
                                        </div>
                                        <p className="mt-3 text-sm text-gray-400">Checked {result.totalChecked || 0} audit records.</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                    <EventFeed events={events} />
                </div>
            </main>
        </div>
    );
}
