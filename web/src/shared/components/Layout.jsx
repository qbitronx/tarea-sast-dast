import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isAdmin = user?.roles?.includes('admin');

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🔐</span>
          <span>Auth Demo</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Dashboard
          </NavLink>
          {isAdmin && (
            <NavLink to="/rbac" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              RBAC Management
            </NavLink>
          )}
          <NavLink to="/products-rbac" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Products (RBAC)
          </NavLink>
          <NavLink to="/products" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Products (ABAC)
          </NavLink>
        </nav>

        <div className="sidebar-user">
          <div className="user-info">
            <div className="user-email">{user?.email}</div>
            <div className="user-meta">
              {user?.roles?.map((r) => (
                <span key={r} className={`role-badge role-${r}`}>{r}</span>
              ))}
              <span className="dept-badge">{user?.department}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
