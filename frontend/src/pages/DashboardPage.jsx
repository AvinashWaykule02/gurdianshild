import { useEffect, useState, useCallback } from 'react';
import { transactionApi } from '../api/transactionApi';
import { incidentApi } from '../api/incidentApi';
import { adminApi } from '../api/adminApi';
import { useAuth } from '../context/AuthContext';
import { useSocketEvents } from '../hooks/useSocketEvents';
import Navbar from '../components/layout/Navbar';
import TransactionForm from '../components/transactions/TransactionForm';
import TransactionTable from '../components/transactions/TransactionTable';
import EventFeed from '../components/events/EventFeed';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// Map LedgerStatus to badge tone
const ledgerTone = { ACTIVE: 'success', LOCKED: 'danger', UNDER_REPAIR: 'warning' };

export default function DashboardPage() {
    const { user } = useAuth();
    const { events } = useSocketEvents();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ledger, setLedger] = useState({ status: 'ACTIVE', lockedReason: null, lockedAt: null });
    const [incidents, setIncidents] = useState([]);

    const loadData = useCallback(async () => {
        try {
            const [txRes, incidentRes] = await Promise.all([
                transactionApi.list(),
                incidentApi.list(),
            ]);

            setTransactions(txRes.data?.data || []);
            setIncidents(incidentRes.data?.data || []);

            // Fetch the actual LedgerState for this user from the backend
            // Regular users won't have SUPER_ADMIN access to /api/admin/... but the backend
            // also allows the user themselves to check their own status via a shared path.
            // We use the admin route here — if the user is not SUPER_ADMIN the 403 is caught
            // and we fall back to the incident heuristic.
            try {
                const ledgerRes = await adminApi.ledgerStatus(user?.id);
                setLedger(ledgerRes.data?.data || { status: 'ACTIVE' });
            } catch {
                // Fallback: infer from open incidents (non-admin users)
                const hasOpenIncident = (incidentRes.data?.data || []).some(
                    (i) => i.status === 'OPEN' || i.status === 'REPAIRING' || i.status === 'UNDER_REVIEW'
                );
                setLedger({ status: hasOpenIncident ? 'LOCKED' : 'ACTIVE', lockedReason: null });
            }
        } catch {
            setLedger({ status: 'ACTIVE' });
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const isLocked = ledger.status !== 'ACTIVE';

    return (
        <div className="min-h-screen bg-surface-900">
            <Navbar />
            <main className="mx-auto max-w-7xl px-6 py-8">
                {/* Header */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm text-shield-400">Overview</p>
                        <h2 className="text-2xl font-semibold text-white">Welcome back, {user?.name}</h2>
                    </div>
                    <div className="rounded-full border border-white/10 bg-surface-800/70 px-4 py-2 text-sm text-gray-400">
                        {loading ? <LoadingSpinner label="Loading ledger data" /> : 'Backend connected'}
                    </div>
                </div>

                {/* Per-user lock banner */}
                {ledger.status === 'LOCKED' && (
                    <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4">
                        <div className="flex items-start gap-3">
                            <span className="text-red-400 text-lg">🔒</span>
                            <div>
                                <p className="text-sm font-semibold text-red-300">
                                    Your ledger is LOCKED — transactions are suspended
                                </p>
                                {ledger.lockedReason && (
                                    <p className="mt-1 text-xs text-red-400/80">{ledger.lockedReason}</p>
                                )}
                                {ledger.lockedAt && (
                                    <p className="mt-1 text-xs text-red-400/60">
                                        Locked at: {new Date(ledger.lockedAt).toLocaleString()}
                                    </p>
                                )}
                                <p className="mt-2 text-xs text-red-400/60">
                                    Contact your SUPERADMIN to trigger a chain repair and unlock.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {ledger.status === 'UNDER_REPAIR' && (
                    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4">
                        <div className="flex items-start gap-3">
                            <span className="text-amber-400 text-lg">🔧</span>
                            <div>
                                <p className="text-sm font-semibold text-amber-300">
                                    Ledger is UNDER REPAIR — awaiting SUPERADMIN unlock
                                </p>
                                {ledger.lockedReason && (
                                    <p className="mt-1 text-xs text-amber-400/80">{ledger.lockedReason}</p>
                                )}
                                <p className="mt-2 text-xs text-amber-400/60">
                                    Chain restoration is complete. A SUPERADMIN will verify and unlock your account shortly.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-6">
                        <TransactionForm onCreated={loadData} locked={isLocked} />
                        <TransactionTable transactions={transactions} loading={loading} />

                        {/* Ledger snapshot */}
                        <Card title="Ledger snapshot" subtitle="Live status for your transaction chain">
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge tone={ledgerTone[ledger.status] || 'info'}>{ledger.status}</Badge>
                                <span className="text-sm text-gray-400">{transactions.length} transactions loaded</span>
                                <span className="text-sm text-gray-400">{incidents.length} incidents visible</span>
                            </div>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        <EventFeed events={events} />
                    </div>
                </div>
            </main>
        </div>
    );
}
