import { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import { useRoles } from '../hooks/useRoles';
import Modal from '../../../shared/components/Modal';

const DEPARTMENTS = ['it', 'sales', 'marketing', 'engineering', 'finance', 'general'];

/* ── Profile form (email / dept / password) ─────────────────────────────── */
function ProfileForm({ initial = {}, onSubmit, onClose }) {
  const isEdit = !!initial.id;
  const [email,      setEmail]      = useState(initial.email || '');
  const [password,   setPassword]   = useState('');
  const [department, setDepartment] = useState(initial.department || 'general');
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    setSaving(true);
    try {
      await onSubmit({ email, department, ...(password ? { password } : {}) });
      onClose();
    } catch (error) {
      setErr(error.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      {err && <div className="alert alert-danger">{err}</div>}
      <div className="form-group">
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>{isEdit ? 'Nueva contraseña (dejar en blanco para no cambiar)' : 'Contraseña'}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!isEdit}
          placeholder={isEdit ? 'Sin cambios' : ''}
        />
      </div>
      <div className="form-group">
        <label>Departamento</label>
        <select value={department} onChange={(e) => setDepartment(e.target.value)}>
          {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

/* ── Role manager modal ──────────────────────────────────────────────────── */
function RoleManagerModal({ user, allRoles, onAssign, onRemove, onClose }) {
  const [busy, setBusy] = useState({});

  const hasRole = (roleName) => user.roles.includes(roleName);

  const toggle = async (role) => {
    setBusy((b) => ({ ...b, [role.id]: true }));
    try {
      if (hasRole(role.name)) await onRemove(user.id, role.id);
      else                    await onAssign(user.id, role.id);
    } finally {
      setBusy((b) => ({ ...b, [role.id]: false }));
    }
  };

  return (
    <Modal title={`Roles de ${user.email}`} onClose={onClose}>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
        Clic en un rol para asignarlo o revocarlo. Los cambios se guardan inmediatamente.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {allRoles.map((role) => {
          const active = hasRole(role.name);
          return (
            <button
              key={role.id}
              onClick={() => toggle(role)}
              disabled={busy[role.id]}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                background: active ? '#22c55e18' : 'var(--bg-3)',
                border: `1px solid ${active ? '#22c55e55' : 'var(--border)'}`,
                transition: 'all .15s',
              }}
            >
              <div>
                <span className={`role-badge role-${role.name}`} style={{ marginRight: 10 }}>
                  {role.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {role.description || '—'} · {role.permissions?.length ?? 0} permisos
                </span>
              </div>
              <span style={{
                fontWeight: 700, fontSize: 13,
                color: active ? '#4ade80' : 'var(--text-muted)',
              }}>
                {busy[role.id] ? '…' : active ? '✓ Asignado' : '+ Asignar'}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}

/* ── Main tab ────────────────────────────────────────────────────────────── */
export default function UsersTab() {
  const { users, loading, error, createUser, updateUser, deleteUser, assignRole, removeRole } = useUsers();
  const { roles: allRoles } = useRoles();
  const [modal, setModal] = useState(null);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span className="card-title" style={{ marginBottom: 0 }}>Usuarios</span>
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          + Nuevo Usuario
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="loading" style={{ height: 100 }}>Cargando…</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Departamento</th>
                <th>Roles</th>
                <th>MFA</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.email}</td>
                  <td><span className="dept-badge">{u.department}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {u.roles.length > 0
                        ? u.roles.map((r) => (
                            <span key={r} className={`role-badge role-${r}`}>{r}</span>
                          ))
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sin roles</span>
                      }
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => setModal({ mode: 'roles', user: u })}
                        title="Gestionar roles"
                      >
                        Gestionar
                      </button>
                    </div>
                  </td>
                  <td style={{ color: u.mfaEnabled ? 'var(--success)' : 'var(--text-muted)' }}>
                    {u.mfaEnabled ? '✓' : '✗'}
                  </td>
                  <td>
                    <div className="td-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => setModal({ mode: 'edit', user: u })}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => deleteUser(u.id)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create */}
      {modal?.mode === 'create' && (
        <Modal title="Crear Usuario" onClose={() => setModal(null)}>
          <ProfileForm
            onSubmit={(data) => createUser({ ...data, roleIds: [] })}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {/* Edit profile */}
      {modal?.mode === 'edit' && (
        <Modal title="Editar Usuario" onClose={() => setModal(null)}>
          <ProfileForm
            initial={modal.user}
            onSubmit={(data) => updateUser(modal.user.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {/* Manage roles — always pass the live user from state so toggles reflect immediately */}
      {modal?.mode === 'roles' && (
        <RoleManagerModal
          user={users.find((u) => u.id === modal.user.id) ?? modal.user}
          allRoles={allRoles}
          onAssign={assignRole}
          onRemove={removeRole}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
