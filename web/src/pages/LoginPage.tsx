import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('demo@flipfeedback.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    setError(null);
    try {
      const res = await api.requestPasswordReset(email);
      setInfo(res.message);
    } catch {
      setInfo('If an account exists for that email, a reset link has been sent.');
    }
  }

  return (
    <div className="auth-wrap">
      <form className="panel auth-card" onSubmit={onSubmit}>
        <div className="brand">
          Flip<span>Feedback</span>
        </div>
        <p className="muted">Sign in to your workspace</p>
        {error && <div className="error">{error}</div>}
        {info && <div className="muted">{info}</div>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p style={{ marginTop: 14 }}>
          <button type="button" onClick={onReset} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--primary)' }}>
            Forgot password?
          </button>
        </p>
        <p className="muted">
          No account? <Link to="/register">Create one</Link>
        </p>
      </form>
    </div>
  );
}
