import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { adminApi } from '../api/adminApi';
import { useAuth } from '../context/AuthContext';
import { useSocketEvents } from '../hooks/useSocketEvents';
import Navbar from '../components/layout/Navbar';
import EventFeed from '../components/events/EventFeed';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

export default function RepairPage() {
    const { user } = useAuth();
    const { events } = useSocketEvents();

    const [lockedUsers, setLockedUsers] = useState([]);     // status === LOCKED
    const [repairingUsers, setRepairingUsers] = useState([]); // status === UNDER_REPAIR
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState({});   // { [userId]: true }
    const [msg, setMsg] = useState({});     // { [userId]: { ok: bool, text: '' } }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await adminApi.overview();
            const all = data?.data?.lockedUsers || [];
            setLockedUsers(all.filter(u => u.status === 'LOCKED'));
            setRepairingUsers(all.filter(u => u.status === 'UNDER_REPAIR'));
        } catch {
            /* silently ignore */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const act = async (userId, action) => {
        setBusy(b => ({ ...b, [userId]: true }));
        setMsg(m => ({ ...m, [userId]: null }));
        try {
            const res = action === 'repair'
                ? await adminApi.repairUser(userId)
                : await adminApi.unlockUser(userId);
            setMsg(m => ({ ...m, [userId]: { ok: true, text: res.data.message || 'Done' } }));
            setTimeout(load, 1500);
        } catch (err) {
            setMsg(m => ({ ...m, [userId]: { ok: false, text: err.response?.data?.message || 'Failed' } }));
        } finally {
            setBusy(b => ({ ...b, [userId]: false }));
        }
    };

    const UserRow = ({ entry, action }) => (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-surface-800/50 px-4 py-3">
            <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                    {entry.user?.name || `User #${entry.userId}`}
                </p>
                <p className="truncate text-xs text-gray-500">{entry.user?.email}</p>
                {entry.lockedReason && (
                    <p className="mt-0.5 truncate text-xs text-red-400/70">{entry.lockedReason}</p>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
                {msg[entry.userId] && (
                    <span className={`text-xs ${msg[entry.userId].ok ? 'text-emerald-400' : 'text-red-400'}`}>
                        {msg[entry.userId].text}
                    </span>
                )}
                <Button
                    onClick={() => act(entry.userId, action)}
                    disabled={!!busy[entry.userId]}
                    variant={action === 'unlock' ? 'secondary' : 'primary'}
                    id={`${action}-${entry.userId}`}
                >
                    {busy[entry.userId]
                        ? action === 'repair' ? 'Queuing…' : 'Unlocking…'
                        : action === 'repair' ? 'Repair' : '🔓 Unlock'}
                </Button>
            </div>
        </div>
    );

    if (user?.role !== 'SUPER_ADMIN') return <Navigate to="/dashboard" replace />;

    return (
        <div className="min-h-screen bg-surface-900">
            <Navbar />
            <main className="mx-auto max-w-5xl px-6 py-8">
                <div className="mb-8">
                    <p className="text-sm text-shield-400">Repair Console</p>
                    <h2 className="text-2xl font-semibold text-white">Chain Repair</h2>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
                    <div className="space-y-6">

                        {/* ── SECTION 1: Corrupted users ── */}
                        <Card
                            title="Corrupted users"
                            subtitle="These users have a LOCKED ledger. Repair restores the chain from S3."
                        >
                            {loading ? (
                                <p className="text-sm text-gray-500 animate-pulse">Loading…</p>
                            ) : lockedUsers.length === 0 ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <Badge tone="success">All clear</Badge>
                                    No corrupted users right now.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {lockedUsers.map(e => (
                                        <UserRow key={e.userId} entry={e} action="repair" />
                                    ))}
                                </div>
                            )}
                        </Card>

                        {/* ── SECTION 2: Users pending unlock ── */}
                        <Card
                            title="Pending unlock"
                            subtitle="Repair is done. Unlock to restore full access."
                        >
                            {loading ? (
                                <p className="text-sm text-gray-500 animate-pulse">Loading…</p>
                            ) : repairingUsers.length === 0 ? (
                                <p className="text-sm text-gray-500">No users awaiting unlock.</p>
                            ) : (
                                <div className="space-y-2">
                                    {repairingUsers.map(e => (
                                        <UserRow key={e.userId} entry={e} action="unlock" />
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Button variant="secondary" onClick={load} className="w-full" disabled={loading}>
                            {loading ? 'Refreshing…' : 'Refresh'}
                        </Button>
                    </div>

                    {/* RIGHT — live event feed */}
                    <EventFeed events={events} />
                </div>
            </main>
        </div>
    );
}
