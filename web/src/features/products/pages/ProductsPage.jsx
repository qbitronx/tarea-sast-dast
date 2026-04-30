import { useState } from 'react';
import { useProducts } from '../hooks/useProducts';
import Modal from '../../../shared/components/Modal';
import PolicyExplainer from '../components/PolicyExplainer';
import { useAuth } from '../../../shared/context/AuthContext';

const STATUSES = ['draft', 'published', 'archived'];
const DEPARTMENTS = ['sales', 'marketing', 'engineering', 'it', 'finance'];

function ProductForm({ initial = {}, onSubmit, onClose, user }) {
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [status, setStatus] = useState(initial.status || 'draft');
  const [department, setDepartment] = useState(initial.department || user.department);
  const [price, setPrice] = useState(initial.price ?? 0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    setSaving(true);
    try {
      await onSubmit({ name, description, status, department, price: Number(price) });
      onClose();
    } catch (error) {
      setErr(error.response?.data?.reason || error.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      {err && <div className="alert alert-danger">{err}</div>}
      <div className="form-group">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Department</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Price</label>
        <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}

function AbacPreviewPanel({ preview }) {
  const [open, setOpen] = useState(false);
  if (!preview?.length) return null;

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setOpen((p) => !p)}>
        <span className="card-title" style={{ marginBottom: 0 }}>ABAC Policy Evaluation (all products)</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Dept</th>
                <th>Owner</th>
                <th>Status</th>
                <th>SELECT</th>
                <th>UPDATE</th>
                <th>DELETE</th>
              </tr>
            </thead>
            <tbody>
              {preview.map(({ product, policies }) => (
                <tr key={product.id}>
                  <td style={{ fontWeight: 500 }}>{product.name}</td>
                  <td><span className="dept-badge">{product.department}</span></td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>#{product.ownerId}</td>
                  <td><span className={`status-badge status-${product.status}`}>{product.status}</span></td>
                  {['select', 'update', 'delete'].map((action) => {
                    const ev = policies[action];
                    return (
                      <td key={action}>
                        <div className="abac-cell">
                          <span className={`allow-pill ${ev.allow ? 'yes' : 'no'}`}>
                            {ev.allow ? '✓ Allow' : '✗ Deny'}
                          </span>
                          <span className="allow-reason" title={ev.reason}>{ev.reason}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();
  const { products, preview, insertPolicy, loading, error, createProduct, updateProduct, deleteProduct } = useProducts();
  const [modal, setModal] = useState(null);
  const [actionError, setActionError] = useState({});

  const handleDelete = async (id) => {
    setActionError((p) => ({ ...p, [id]: '' }));
    try {
      await deleteProduct(id);
    } catch (err) {
      setActionError((p) => ({
        ...p,
        [id]: err.response?.data?.reason || err.response?.data?.error || 'Delete failed',
      }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Products</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {insertPolicy && (
            <PolicyExplainer label="INSERT" evaluation={insertPolicy} />
          )}
          <button
            className="btn-primary"
            onClick={() => setModal({ mode: 'create' })}
            disabled={insertPolicy && !insertPolicy.allow}
            title={insertPolicy && !insertPolicy.allow ? insertPolicy.reason : undefined}
          >
            + New Product
          </button>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        <strong>ABAC demo:</strong> Access is controlled by user attributes (department, id) × product attributes (department, ownerId, status).
        {!user.roles.includes('admin') && ` You see only "${user.department}" products.`}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? <div className="loading" style={{ height: 100 }}>Loading…</div> : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Description</th><th>Dept</th><th>Status</th><th>Price</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No products visible to you.</td></tr>
                )}
                {products.map((p) => {
                  const previewItem = preview.find((x) => x.product.id === p.id);
                  const canUpdate = previewItem?.policies?.update?.allow ?? true;
                  const canDelete = previewItem?.policies?.delete?.allow ?? true;
                  const updateReason = previewItem?.policies?.update?.reason;
                  const deleteReason = previewItem?.policies?.delete?.reason;

                  return (
                    <>
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{p.description || '—'}</td>
                        <td><span className="dept-badge">{p.department}</span></td>
                        <td><span className={`status-badge status-${p.status}`}>{p.status}</span></td>
                        <td>${p.price.toFixed(2)}</td>
                        <td>
                          <div className="td-actions">
                            <button
                              className="btn-secondary"
                              onClick={() => setModal({ mode: 'edit', product: p })}
                              disabled={!canUpdate}
                              title={!canUpdate ? updateReason : undefined}
                            >Edit</button>
                            <button
                              className="btn-danger"
                              onClick={() => handleDelete(p.id)}
                              disabled={!canDelete}
                              title={!canDelete ? deleteReason : undefined}
                            >Delete</button>
                          </div>
                        </td>
                      </tr>
                      {actionError[p.id] && (
                        <tr key={`${p.id}-err`}>
                          <td colSpan={6} style={{ padding: '4px 12px' }}>
                            <div className="alert alert-danger" style={{ margin: 0, fontSize: 12 }}>
                              {actionError[p.id]}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AbacPreviewPanel preview={preview} />

      {modal?.mode === 'create' && (
        <Modal title="Create Product" onClose={() => setModal(null)}>
          <ProductForm user={user} onSubmit={createProduct} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal title="Edit Product" onClose={() => setModal(null)}>
          <ProductForm
            user={user}
            initial={modal.product}
            onSubmit={(data) => updateProduct(modal.product.id, data)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
