import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import SecurityPage from './pages/SecurityPage';
import IncidentsPage from './pages/IncidentsPage';
import RepairPage from './pages/RepairPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#161d35',
                color: '#e5e7eb',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                fontSize: '13px',
              },
            }}
          />

          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute><SecurityPage /></ProtectedRoute>} />
            <Route path="/incidents" element={<ProtectedRoute><IncidentsPage /></ProtectedRoute>} />
            <Route path="/repair" element={<ProtectedRoute><RepairPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
