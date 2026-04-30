import { useState } from 'react';
import { useRoles } from '../hooks/useRoles';
import Modal from '../../../shared/components/Modal';

const RESOURCES = ['users', 'roles', 'products'];
const ACTIONS   = ['create', 'read', 'update', 'delete'];

function RoleForm({ initial = {}, onSubmit, onClose }) {
  const [name, setName]               = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    setSaving(true);
    try {
      await onSubmit({ name, description });
      onClose();
    } catch (error) {
      setErr(error.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      {err && <div className="alert alert-danger">{err}</div>}
      <div className="form-group">
        <label>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="ej. moderador" />
      </div>
      <div className="form-group">
        <label>Descripción</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  );
}

function PermissionMatrix({ role, allPermissions, onAssign, onRemove }) {
  const [busy, setBusy] = useState({});

  const hasPermission = (resource, action) =>
    role.permissions.some((p) => p.resource === resource && p.action === action);

  const getPermId = (resource, action) => {
    const p = allPermissions.find((p) => p.resource === resource && p.action === action);
    return p?.id;
  };

  const toggle = async (resource, action) => {
    const permId = getPermId(resource, action);
    if (!permId) return;
    const key = `${resource}:${action}`;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      if (hasPermission(resource, action)) {
        await onRemove(role.id, permId);
      } else {
        await onAssign(role.id, permId);
      }
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  return (
    <div style={{ padding: '16px 20px', background: 'var(--bg-3)', borderTop: '1px solid var(--border)' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Clic en una celda para conceder o revocar el permiso al rol <strong>{role.name}</strong>.
      </p>
      <table style={{ fontSize: 12, width: 'auto', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 12px 4px 0', color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.5px' }}>Recurso</th>
            {ACTIONS.map((a) => (
              <th key={a} style={{ padding: '4px 10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', textAlign: 'center' }}>{a}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((resource) => (
            <tr key={resource}>
              <td style={{ padding: '6px 12px 6px 0', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text)' }}>{resource}</td>
              {ACTIONS.map((action) => {
                const active = hasPermission(resource, action);
                const key    = `${resource}:${action}`;
                const exists = !!getPermId(resource, action);
                return (
                  <td key={action} style={{ textAlign: 'center', padding: '4px 10px' }}>
                    {exists ? (
                      <button
                        onClick={() => toggle(resource, action)}
                        disabled={busy[key]}
                        title={active ? `Revocar ${resource}:${action}` : `Conceder ${resource}:${action}`}
                        style={{
                          width: 32, height: 32, borderRadius: 6, fontWeight: 700, fontSize: 14,
                          background: active ? '#22c55e22' : 'var(--bg)',
                          border: `1px solid ${active ? '#22c55e55' : 'var(--border)'}`,
                          color: active ? '#4ade80' : 'var(--text-muted)',
                          cursor: 'pointer', transition: 'all .15s',
                        }}
                      >
                        {busy[key] ? '…' : active ? '✓' : '○'}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--border)' }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RolesTab() {
  const { roles, allPermissions, loading, error, createRole, updateRole, deleteRole, assignPermission, removePermission } = useRoles();
  const [modal, setModal]       = useState(null);
  const [expanded, setExpanded] = useState(null);

  const toggleExpand = (id) => setExpanded((prev) => (prev === id ? null : id));

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span className="card-title" style={{ marginBottom: 0 }}>Roles</span>
        <button className="btn-primary" onClick={() => setModal({ mode: 'create' })}>+ Nuevo Rol</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? <div className="loading" style={{ height: 100 }}>Cargando…</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Permisos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <>
                  <tr key={r.id}>
                    <td><span className={`role-badge role-${r.name}`}>{r.name}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.description || '—'}</td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 12 }}
                        onClick={() => toggleExpand(r.id)}
                      >
                        {r.permissions.length} permiso{r.permissions.length !== 1 ? 's' : ''} {expanded === r.id ? '▲' : '▼'}
                      </button>
                    </td>
                    <td>
                      <div className="td-actions">
                        <button className="btn-secondary" onClick={() => setModal({ mode: 'edit', role: r })}>Editar</button>
                        <button className="btn-danger"    onClick={() => deleteRole(r.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>

                  {expanded === r.id && (
                    <tr key={`${r.id}-perms`}>
                      <td colSpan={4} style={{ padding: 0 }}>
                        <PermissionMatrix
                          role={r}
                          allPermissions={allPermissions}
                          onAssign={assignPermission}
                          onRemove={removePermission}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal?.mode === 'create' && (
        <Modal title="Crear Rol" onClose={() => setModal(null)}>
          <RoleForm onSubmit={createRole} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal title="Editar Rol" onClose={() => setModal(null)}>
          <RoleForm
            initial={modal.role}
            onSubmit={(data) => updateRole(modal.role.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
