import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(form.email, form.password);

      if (data.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your GuardianShield account to monitor ledger integrity"
    >
      <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="login-email" className="block text-xs font-medium text-gray-400 pl-1">
            Email address
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={handleChange}
            className="input-field"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="login-password" className="block text-xs font-medium text-gray-400 pl-1">
            Password
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={form.password}
            onChange={handleChange}
            className="input-field"
          />
        </div>

        {/* Error */}
        {error && (
          <div
            id="login-error"
            className="rounded-lg border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-xs text-red-400 animate-fade-in"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          id="login-submit"
          type="submit"
          disabled={loading}
          className="btn-primary mt-2"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              Signing in…
            </span>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* Link to signup */}
      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="font-medium text-shield-400 hover:text-shield-300 transition-colors">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
