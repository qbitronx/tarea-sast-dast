import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import { useLogin } from '../hooks/useLogin';

const DEMO_USERS = [
  { email: 'admin@demo.com', password: 'Admin123!', role: 'admin', dept: 'it' },
  { email: 'alice@demo.com', password: 'Alice123!', role: 'editor', dept: 'sales' },
  { email: 'bob@demo.com',   password: 'Bob123!',   role: 'viewer', dept: 'marketing' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { step, loading, error, submitCredentials, submitMfa } = useLogin();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode]         = useState('');

  useEffect(() => { if (user) navigate('/dashboard'); }, [user, navigate]);

  const handleCredentials = (e) => {
    e.preventDefault();
    submitCredentials({ email, password });
  };

  const handleMfa = (e) => {
    e.preventDefault();
    submitMfa({ code });
  };

  const fillCredentials = (u) => { setEmail(u.email); setPassword(u.password); };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>🔐 Auth Demo</h1>
          <p>Authentication · RBAC · ABAC</p>
        </div>

        <div className="login-card">
          {step === 'credentials' ? (
            <>
              <h2>Sign in</h2>
              {error && <div className="alert alert-danger">{error}</div>}
              <form onSubmit={handleCredentials}>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit" className="btn-primary login-btn" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>Two-factor authentication</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                Enter the 6-digit code from your authenticator app.
              </p>
              {error && <div className="alert alert-danger">{error}</div>}
              <form onSubmit={handleMfa}>
                <div className="form-group">
                  <label>OTP Code</label>
                  <input
                    type="text" value={code} inputMode="numeric" maxLength={6}
                    onChange={(e) => setCode(e.target.value)} required autoFocus
                    placeholder="000000"
                    style={{ letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' }}
                  />
                </div>
                <button type="submit" className="btn-primary login-btn" disabled={loading}>
                  {loading ? 'Verifying…' : 'Verify'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="demo-creds">
          <h4>Demo Credentials</h4>
          {DEMO_USERS.map((u) => (
            <div
              key={u.email} className="cred-row"
              style={{ cursor: 'pointer', borderRadius: 4, padding: '6px 4px' }}
              onClick={() => fillCredentials(u)}
              title="Click to fill"
            >
              <span className="cred-user">
                <span className={`role-badge role-${u.role}`}>{u.role}</span>
                {' '}{u.email} <span className="dept-badge">{u.dept}</span>
              </span>
              <span className="cred-pass">{u.password}</span>
            </div>
          ))}
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Click a row to fill credentials</p>
        </div>
      </div>
    </div>
  );
}
