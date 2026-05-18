import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { tenantService } from '@features/tenants/api';

export function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setInvalid(true);
      return;
    }
    tenantService
      .activate(token)
      .then(() => setChecking(false))
      .catch(() => {
        setChecking(false);
        setInvalid(true);
        setError('This link has expired or was already used.');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await tenantService.activateAccount({ token, password, confirm_password: confirmPassword });
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setError(e?.response?.data?.error?.message ?? 'Activation failed');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <p className="text-foreground font-medium">{error || 'Invalid activation link'}</p>
        <Link to="/login" className="mt-4 text-accent text-sm font-medium">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-foreground">Activate your account</h1>
        <p className="text-sm text-muted-foreground">Set a password to access your tenant portal.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background"
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-semibold disabled:opacity-50"
        >
          {loading ? 'Activating…' : 'Activate'}
        </button>
      </form>
    </div>
  );
}
