import { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import { useRoles } from '../hooks/useRoles';

export default function AssignmentsTab() {
  const { users, loading: uLoading, assignRole, removeRole } = useUsers();
  const { roles, loading: rLoading } = useRoles();
  const [busy, setBusy] = useState({});

  if (uLoading || rLoading) return <div className="loading" style={{ height: 100 }}>Loading…</div>;

  const toggle = async (userId, role, hasRole) => {
    const key = `${userId}-${role.id}`;
    setBusy((p) => ({ ...p, [key]: true }));
    try {
      if (hasRole) await removeRole(userId, role.id);
      else await assignRole(userId, role.id);
    } finally {
      setBusy((p) => ({ ...p, [key]: false }));
    }
  };

  return (
    <div className="card">
      <div className="card-title">Role — User Assignments</div>
      <div className="alert alert-info" style={{ marginBottom: 16 }}>
        Click a cell to toggle a role assignment. Changes take effect immediately.
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Department</th>
              {roles.map((r) => <th key={r.id}>{r.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.email}</td>
                <td><span className="dept-badge">{u.department}</span></td>
                {roles.map((r) => {
                  const hasRole = u.roles.includes(r.name);
                  const key = `${u.id}-${r.id}`;
                  return (
                    <td key={r.id} style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => toggle(u.id, r, hasRole)}
                        disabled={busy[key]}
                        style={{
                          background: hasRole ? '#22c55e22' : 'var(--bg-3)',
                          border: `1px solid ${hasRole ? '#22c55e44' : 'var(--border)'}`,
                          color: hasRole ? '#4ade80' : 'var(--text-muted)',
                          padding: '4px 12px', borderRadius: 20, fontWeight: 600, fontSize: 12,
                        }}
                      >
                        {busy[key] ? '…' : hasRole ? '✓' : '○'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
