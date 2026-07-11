import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'USER' });
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
      const data = await signup(form.name, form.email, form.password, form.role);

      if (data.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setError(data.message || 'Signup failed');
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
      title="Create your account"
      subtitle="Start securing your financial ledger with GuardianShield"
    >
      <form onSubmit={handleSubmit} className="space-y-5" id="signup-form">
        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="signup-name" className="block text-xs font-medium text-gray-400 pl-1">
            Full name
          </label>
          <input
            id="signup-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Jane Doe"
            value={form.name}
            onChange={handleChange}
            className="input-field"
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="signup-email" className="block text-xs font-medium text-gray-400 pl-1">
            Email address
          </label>
          <input
            id="signup-email"
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

        {/* Role */}
        <div className="space-y-1.5">
          <label htmlFor="signup-role" className="block text-xs font-medium text-gray-400 pl-1">
            Role
          </label>
          <select
            id="signup-role"
            name="role"
            value={form.role}
            onChange={handleChange}
            className="input-field"
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin / Superadmin</option>
          </select>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="signup-password" className="block text-xs font-medium text-gray-400 pl-1">
            Password
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="min. 6 characters"
            value={form.password}
            onChange={handleChange}
            className="input-field"
          />
        </div>

        {/* Error */}
        {error && (
          <div
            id="signup-error"
            className="rounded-lg border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-xs text-red-400 animate-fade-in"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          id="signup-submit"
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
              Creating account…
            </span>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      {/* Link to login */}
      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-shield-400 hover:text-shield-300 transition-colors">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
