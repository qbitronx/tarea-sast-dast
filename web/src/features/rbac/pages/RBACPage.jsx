import { useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import UsersTab       from '../components/UsersTab';
import RolesTab       from '../components/RolesTab';
import AssignmentsTab from '../components/AssignmentsTab';

const TABS = ['Usuarios', 'Roles', 'Asignaciones'];

export default function RBACPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('Usuarios');

  if (!user.roles.includes('admin')) {
    return (
      <div>
        <div className="page-header"><h1 className="page-title">RBAC Management</h1></div>
        <div className="alert alert-danger">Acceso denegado — se requiere rol admin.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">RBAC Management</h1>
        <div className="alert alert-info" style={{ margin: 0, fontSize: 12 }}>
          Gestión de usuarios, roles y asignaciones
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Usuarios'     && <UsersTab />}
      {tab === 'Roles'        && <RolesTab />}
      {tab === 'Asignaciones' && <AssignmentsTab />}
    </div>
  );
}
