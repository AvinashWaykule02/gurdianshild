import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocketEvents } from '../../hooks/useSocketEvents';
import Badge from '../ui/Badge';

export default function Navbar() {
    const navigate = useNavigate();
    const { user, logout, role } = useAuth();
    const { events } = useSocketEvents();

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    if (!user) return null;

    return (
        <header className="border-b border-white/10 bg-surface-900/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                <div>
                    <h1 className="text-lg font-semibold text-white">GuardianShield Dashboard</h1>
                    <p className="text-sm text-gray-400">Live ledger demo with backend events</p>
                </div>

                <nav className="hidden items-center gap-2 md:flex">
                    <NavLink to="/dashboard" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-shield-600/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                        Dashboard
                    </NavLink>
                    <NavLink to="/security" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-shield-600/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                        Security
                    </NavLink>
                    <NavLink to="/incidents" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-shield-600/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                        Incidents
                    </NavLink>
                    {role === 'SUPER_ADMIN' && (
                        <>
                            <NavLink to="/repair" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-shield-600/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                                Repair
                            </NavLink>
                            <NavLink to="/admin" className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-shield-600/20 text-white' : 'text-gray-400 hover:text-white'}`}>
                                Admin
                            </NavLink>
                        </>
                    )}
                </nav>

                <div className="flex items-center gap-3">
                    <Badge tone="info">{role}</Badge>
                    <span className="text-sm text-gray-300">{user.name}</span>
                    <span className="text-xs text-gray-500">{events.length} events</span>
                    <button onClick={handleLogout} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5">
                        Logout
                    </button>
                </div>
            </div>
        </header>
    );
}
