import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { adminApi } from '../api/adminApi';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

const incidentTone = { OPEN: 'danger', APPROVED: 'warning', REPAIRING: 'info', RESOLVED: 'success', REJECTED: 'info' };

export default function AdminPage() {
    const { user } = useAuth();
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Selected user panel
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedUserTransactions, setSelectedUserTransactions] = useState([]);
    const [selectedUserIncidents, setSelectedUserIncidents] = useState([]);
    const [selectedLedger, setSelectedLedger] = useState(null);
    const [selectedIncidentId, setSelectedIncidentId] = useState('');

    // Busy / feedback
    const [busyAction, setBusyAction] = useState('');
    const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await adminApi.overview();
                setOverview(data?.data || null);
                const firstId = data?.data?.users?.[0]?.id;
                if (firstId) setSelectedUserId(String(firstId));
            } catch (err) {
                setError(err.response?.data?.message || 'Could not load admin overview');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        const loadUser = async () => {
            if (!selectedUserId) return;
            setActionMsg({ type: '', text: '' });
            try {
                const [txRes, incRes, ledgerRes] = await Promise.all([
                    adminApi.userTransactions(selectedUserId),
                    adminApi.userIncidents(selectedUserId),
                    adminApi.ledgerStatus(selectedUserId),
                ]);
                setSelectedUserTransactions(txRes.data?.data || []);
                const incs = incRes.data?.data || [];
                setSelectedUserIncidents(incs);
                setSelectedIncidentId(incs[0]?.id ? String(incs[0].id) : '');
                setSelectedLedger(ledgerRes.data?.data || null);
            } catch {
                setSelectedUserTransactions([]);
                setSelectedUserIncidents([]);
                setSelectedLedger(null);
                setSelectedIncidentId('');
            }
        };
        loadUser();
    }, [selectedUserId]);

    if (user?.role !== 'SUPER_ADMIN') {
        return <Navigate to="/dashboard" replace />;
    }

    const runAction = async (action, label) => {
        setBusyAction(action);
        setActionMsg({ type: '', text: '' });
        try {
            let data;
            if (action === 'verify') {
                ({ data } = await adminApi.verifyChain(selectedUserId));
                const msg = data.data?.valid
                    ? `✅ Chain healthy (${data.data.totalChecked} logs checked)`
                    : `⚠️ ${data.data?.incidents?.length} issue(s) detected`;
                setActionMsg({ type: data.data?.valid ? 'success' : 'error', text: msg });
            } else if (action === 'repair') {
                ({ data } = await adminApi.repairUser(selectedUserId));
                setActionMsg({ type: 'success', text: data.message || 'Repair queued' });
            } else if (action === 'unlock') {
                ({ data } = await adminApi.unlockUser(selectedUserId));
                setActionMsg({ type: 'success', text: data.message || 'Ledger unlocked' });
            }
            // Reload ledger status for selected user
            const ledgerRes = await adminApi.ledgerStatus(selectedUserId);
            setSelectedLedger(ledgerRes.data?.data || null);
        } catch (err) {
            setActionMsg({ type: 'error', text: err.response?.data?.message || `${label} failed` });
        } finally {
            setBusyAction('');
        }
    };

    const ledgerStatusTone = { ACTIVE: 'success', LOCKED: 'danger', UNDER_REPAIR: 'warning' };

    return (
        <div className="min-h-screen bg-surface-900">
            <Navbar />
            <main className="mx-auto max-w-7xl px-6 py-8">
                <div className="mb-6">
                    <p className="text-sm text-shield-400">Admin</p>
                    <h2 className="text-2xl font-semibold text-white">SUPERADMIN Control Panel</h2>
                </div>

                {loading ? (
                    <p className="text-gray-400">Loading admin data…</p>
                ) : error ? (
                    <p className="text-red-400">{error}</p>
                ) : (
                    <div className="space-y-6">
                        {/* Summary stats */}
                        <div className="grid gap-6 xl:grid-cols-3">
                            <Card title="Users" subtitle="Registered accounts">
                                <p className="text-3xl font-semibold text-white">{overview?.users?.length || 0}</p>
                            </Card>
                            <Card title="Transactions" subtitle="Recent ledger entries">
                                <p className="text-3xl font-semibold text-white">{overview?.transactions?.length || 0}</p>
                            </Card>
                            <Card title="Locked users" subtitle="Users with LOCKED or UNDER_REPAIR state">
                                <p className="text-3xl font-semibold text-white">{overview?.lockedUsers?.length || 0}</p>
                            </Card>
                        </div>

                        {/* Per-user control panel */}
                        <Card title="User control" subtitle="Inspect a user, verify their chain, repair it, or unlock the ledger">
                            <div className="space-y-4">
                                {/* User selector */}
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    className="input-field"
                                >
                                    {(overview?.users || []).map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name} — {u.email} ({u.role})
                                        </option>
                                    ))}
                                </select>

                                {/* Ledger status for selected user */}
                                {selectedLedger && (
                                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-surface-800/60 px-4 py-2">
                                        <span className="text-sm text-gray-400">Ledger status:</span>
                                        <Badge tone={ledgerStatusTone[selectedLedger.status] || 'info'}>
                                            {selectedLedger.status}
                                        </Badge>
                                        {selectedLedger.lockedReason && (
                                            <span className="text-xs text-gray-500 ml-1">{selectedLedger.lockedReason}</span>
                                        )}
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        onClick={() => runAction('verify', 'Verify')}
                                        disabled={!selectedUserId || !!busyAction}
                                        id="admin-verify-btn"
                                    >
                                        {busyAction === 'verify' ? 'Verifying…' : 'Verify chain'}
                                    </Button>

                                    <Button
                                        variant="secondary"
                                        onClick={() => runAction('repair', 'Repair')}
                                        disabled={!selectedUserId || !!busyAction || selectedLedger?.status === 'UNDER_REPAIR'}
                                        id="admin-repair-btn"
                                        title={
                                            selectedLedger?.status === 'UNDER_REPAIR'
                                                ? 'Repair already in progress — unlock first'
                                                : 'Queue chain repair (requires APPROVED incident)'
                                        }
                                    >
                                        {busyAction === 'repair' ? 'Queuing…' : 'Repair chain'}
                                    </Button>

                                    <Button
                                        variant="secondary"
                                        onClick={() => runAction('unlock', 'Unlock')}
                                        disabled={
                                            !selectedUserId ||
                                            !!busyAction ||
                                            selectedLedger?.status !== 'UNDER_REPAIR'
                                        }
                                        id="admin-unlock-btn"
                                        title={
                                            selectedLedger?.status !== 'UNDER_REPAIR'
                                                ? 'Can only unlock after repair completes (UNDER_REPAIR state)'
                                                : 'Unlock ledger for this user'
                                        }
                                        className={selectedLedger?.status === 'UNDER_REPAIR' ? 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10' : ''}
                                    >
                                        {busyAction === 'unlock' ? 'Unlocking…' : '🔓 Unlock ledger'}
                                    </Button>
                                </div>

                                {/* Action feedback */}
                                {actionMsg.text && (
                                    <div className={`rounded-xl border px-3 py-2 text-sm ${
                                        actionMsg.type === 'success'
                                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                            : 'border-red-500/20 bg-red-500/10 text-red-300'
                                    }`}>
                                        {actionMsg.text}
                                    </div>
                                )}

                                {/* User detail panel */}
                                <div className="rounded-2xl border border-white/10 bg-surface-800/60 p-4">
                                    <div className="mb-3 flex items-center gap-2">
                                        <Badge tone="info">Selected user</Badge>
                                        <span className="text-sm text-gray-400">
                                            {selectedUserId ? `User #${selectedUserId}` : 'Choose a user'}
                                        </span>
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-2">
                                        {/* Transactions */}
                                        <div>
                                            <p className="mb-2 text-sm font-semibold text-white">Recent transactions</p>
                                            <div className="space-y-2 text-sm text-gray-400">
                                                {selectedUserTransactions.length === 0 ? (
                                                    <p className="text-gray-500">No transactions found.</p>
                                                ) : (
                                                    selectedUserTransactions.slice(0, 6).map((tx) => (
                                                        <div key={tx.id} className="rounded-lg border border-white/10 bg-surface-900/70 p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span>{tx.description || 'Transaction'}</span>
                                                                <span className="text-white">₹{Number(tx.amount).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {/* Incidents */}
                                        <div>
                                            <p className="mb-2 text-sm font-semibold text-white">User incidents</p>
                                            <div className="space-y-2 text-sm text-gray-400">
                                                {selectedUserIncidents.length === 0 ? (
                                                    <p className="text-gray-500">No incidents found.</p>
                                                ) : (
                                                    selectedUserIncidents.map((item) => (
                                                        <div key={item.id} className="rounded-lg border border-white/10 bg-surface-900/70 p-3">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <span>{item.title || `Incident #${item.id}`}</span>
                                                                <Badge tone={incidentTone[item.status] || 'info'}>
                                                                    {item.status}
                                                                </Badge>
                                                            </div>
                                                            {item.description && (
                                                                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                                                                    {item.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </main>
        </div>
    );
}
