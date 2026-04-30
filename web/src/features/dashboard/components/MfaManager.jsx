import { useState } from 'react';
import client from '../../../api/client';
import { useAuth } from '../../../shared/context/AuthContext';

export default function MfaManager() {
  const { user, refreshUser } = useAuth();
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  const startSetup = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await client.get('/auth/mfa/setup');
      setQrCode(data.qrCodeUrl);
      setSecret(data.secret);
      setShowSetup(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to setup MFA');
    } finally { setLoading(false); }
  };

  const confirmEnable = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await client.post('/auth/mfa/enable', { code });
      setMessage('MFA enabled successfully!');
      setShowSetup(false); setCode('');
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
    } finally { setLoading(false); }
  };

  const confirmDisable = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await client.post('/auth/mfa/disable', { code });
      setMessage('MFA disabled.');
      setShowDisable(false); setCode('');
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
    } finally { setLoading(false); }
  };

  return (
    <div className="card">
      <div className="card-title">Multi-Factor Authentication</div>

      {message && <div className="alert alert-success">{message}</div>}
      {error   && <div className="alert alert-danger">{error}</div>}

      <div className="info-row">
        <span className="info-key">Status</span>
        <span style={{ color: user.mfaEnabled ? 'var(--success)' : 'var(--text-muted)' }}>
          {user.mfaEnabled ? '✓ Enabled' : '✗ Disabled'}
        </span>
      </div>

      {!user.mfaEnabled && !showSetup && (
        <button className="btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={startSetup} disabled={loading}>
          {loading ? 'Generating…' : 'Enable MFA'}
        </button>
      )}

      {showSetup && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 12, fontSize: 13 }}>
            Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img src={qrCode} alt="QR Code" className="mfa-setup" style={{ width: 180, height: 180, borderRadius: 8, background: '#fff', padding: 8 }} />
          </div>
          <div className="alert alert-info" style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 13 }}>
            Manual key: {secret}
          </div>
          <form onSubmit={confirmEnable} style={{ marginTop: 12 }}>
            <div className="form-group">
              <label>Confirm 6-digit code</label>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" placeholder="000000" autoFocus />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowSetup(false)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading || code.length < 6}>Confirm</button>
            </div>
          </form>
        </div>
      )}

      {user.mfaEnabled && !showDisable && (
        <button className="btn-danger" style={{ marginTop: 16, width: '100%' }} onClick={() => setShowDisable(true)}>
          Disable MFA
        </button>
      )}

      {showDisable && (
        <form onSubmit={confirmDisable} style={{ marginTop: 16 }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 12, fontSize: 13 }}>
            Enter your current OTP to disable MFA.
          </p>
          <div className="form-group">
            <label>OTP Code</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} inputMode="numeric" placeholder="000000" autoFocus />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowDisable(false)}>Cancel</button>
            <button type="submit" className="btn-danger" disabled={loading || code.length < 6}>Disable</button>
          </div>
        </form>
      )}
    </div>
  );
}
