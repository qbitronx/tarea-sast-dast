import { useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useRoles } from '../hooks/useRoles';
import { useRbacProducts } from '../hooks/useRbacProducts';
import Modal from '../../../shared/components/Modal';

const DEPARTMENTS = ['sales', 'marketing', 'engineering', 'it', 'finance'];
const STATUSES    = ['draft', 'published', 'archived'];

/** Computes the set of "resource:action" permissions the current user holds */
function useEffectivePermissions() {
  const { user }              = useAuth();
  const { roles, allPermissions } = useRoles();

  const perms = new Set();
  roles
    .filter((r) => user?.roles?.includes(r.name))
    .forEach((r) => r.permissions.forEach((p) => perms.add(`${p.resource}:${p.action}`)));
  return perms;
}

function ProductForm({ initial = {}, onSubmit, onClose }) {
  const { user } = useAuth();
  const [name, setName]             = useState(initial.name || '');
  const [description, setDesc]      = useState(initial.description || '');
  const [status, setStatus]         = useState(initial.status || 'draft');
  const [department, setDepartment] = useState(initial.department || user.department);
  const [price, setPrice]           = useState(initial.price ?? 0);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    setSaving(true);
    try {
      await onSubmit({ name, description, status, department, price: Number(price) });
      onClose();
    } catch (error) {
      setErr(error.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      {err && <div className="alert alert-danger">{err}</div>}
      <div className="form-group">
        <label>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Descripción</label>
        <input value={description} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label>Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Departamento</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Precio</label>
        <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  );
}

function PermBadge({ label, active }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: active ? '#22c55e18' : '#ef444418',
      border: `1px solid ${active ? '#22c55e44' : '#ef444444'}`,
      color: active ? '#4ade80' : '#fca5a5',
    }}>
      {active ? '✓' : '✗'} {label}
    </span>
  );
}

export default function ProductsRBACTab() {
  const { user }                                         = useAuth();
  const perms                                            = useEffectivePermissions();
  const { products, loading, error, denied,
          createProduct, updateProduct, deleteProduct }  = useRbacProducts();
  const [modal, setModal]                               = useState(null);
  const [actionError, setActionError]                   = useState('');

  const can = (action) => perms.has(`products:${action}`);

  const handleDelete = async (id) => {
    setActionError('');
    try { await deleteProduct(id); }
    catch (err) { setActionError(err.response?.data?.error || 'Error al eliminar'); }
  };

  return (
    <div>
      {/* Permission summary */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">
          Permisos RBAC efectivos de <strong>{user.email}</strong>
          {' '}
          {user.roles.map((r) => (
            <span key={r} className={`role-badge role-${r}`} style={{ marginLeft: 6 }}>{r}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PermBadge label="products:read"   active={can('read')}   />
          <PermBadge label="products:create" active={can('create')} />
          <PermBadge label="products:update" active={can('update')} />
          <PermBadge label="products:delete" active={can('delete')} />
        </div>
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          A diferencia de la página <em>Products (ABAC)</em>, aquí el acceso se controla
          únicamente por el rol — sin filtro por departamento ni por propiedad.
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontWeight: 600 }}>Todos los productos</span>
        <button
          className="btn-primary"
          disabled={!can('create')}
          title={!can('create') ? 'Tu rol no tiene products:create' : undefined}
          onClick={() => setModal({ mode: 'create' })}
        >
          + Nuevo Producto
        </button>
      </div>

      {actionError && <div className="alert alert-danger">{actionError}</div>}

      {denied && (
        <div className="alert alert-danger">
          <strong>403 Forbidden</strong> — tu rol no tiene <code>products:read</code>.
          Asigna ese permiso al rol desde la pestaña <strong>Roles</strong>.
        </div>
      )}

      {error   && <div className="alert alert-danger">{error}</div>}
      {loading && <div className="loading" style={{ height: 100 }}>Cargando…</div>}

      {!denied && !loading && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Departamento</th>
                  <th>Estado</th>
                  <th>Precio</th>
                  <th>Propietario</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>
                      Sin productos
                    </td>
                  </tr>
                )}
                {products.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td><span className="dept-badge">{p.department}</span></td>
                    <td><span className={`status-badge status-${p.status}`}>{p.status}</span></td>
                    <td>${Number(p.price).toFixed(2)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>uid:{p.ownerId}</td>
                    <td>
                      <div className="td-actions">
                        <button
                          className="btn-secondary"
                          disabled={!can('update')}
                          title={!can('update') ? 'Tu rol no tiene products:update' : undefined}
                          onClick={() => setModal({ mode: 'edit', product: p })}
                        >
                          Editar
                        </button>
                        <button
                          className="btn-danger"
                          disabled={!can('delete')}
                          title={!can('delete') ? 'Tu rol no tiene products:delete' : undefined}
                          onClick={() => handleDelete(p.id)}
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
        </div>
      )}

      {modal?.mode === 'create' && (
        <Modal title="Crear Producto (RBAC)" onClose={() => setModal(null)}>
          <ProductForm onSubmit={createProduct} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal title="Editar Producto (RBAC)" onClose={() => setModal(null)}>
          <ProductForm
            initial={modal.product}
            onSubmit={(data) => updateProduct(modal.product.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
