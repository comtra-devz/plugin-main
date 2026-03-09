import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { logout } from './AdminLogin';

type SidebarProps = { open?: boolean; onClose?: () => void };

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [logoutMessage, setLogoutMessage] = useState(false);

  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname;
      onClose?.();
    }
  }, [location.pathname, onClose]);

  const handleLogout = () => {
    setLogoutMessage(true);
    window.setTimeout(() => logout(), 1500);
  };

  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="Navigazione">
      <div className="sidebar-title">Comtra Admin</div>
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Home
        </NavLink>
        <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
          Utenti
        </NavLink>
        <NavLink to="/credits" className={({ isActive }) => (isActive ? 'active' : '')}>
          Crediti e costi
        </NavLink>
        <NavLink to="/executions" className={({ isActive }) => (isActive ? 'active' : '')}>
          Storico utilizzo
        </NavLink>
        <NavLink to="/affiliates" className={({ isActive }) => (isActive ? 'active' : '')}>
          Affiliati
        </NavLink>
        <NavLink to="/discounts" className={({ isActive }) => (isActive ? 'active' : '')}>
          Codici sconto
        </NavLink>
        <NavLink to="/ab-tests" className={({ isActive }) => (isActive ? 'active' : '')}>
          A/B Tests
        </NavLink>
        <span className="sidebar-group" aria-hidden="true">Content Management</span>
        <NavLink to="/content/documentation" className={({ isActive }) => (isActive ? 'active' : '')}>
          Documentation
        </NavLink>
        <NavLink to="/content/altro" className={({ isActive }) => (isActive ? 'active' : '')}>
          Altro
        </NavLink>
        <NavLink to="/content/aggiornamenti" className={({ isActive }) => (isActive ? 'active' : '')}>
          Aggiornamenti
        </NavLink>
        <NavLink to="/health" className={({ isActive }) => (isActive ? 'active' : '')}>
          Stato servizi
        </NavLink>
        <NavLink to="/support" className={({ isActive }) => (isActive ? 'active' : '')}>
          Supporto
        </NavLink>
        <NavLink to="/security" className={({ isActive }) => (isActive ? 'active' : '')}>
          Sicurezza e log
        </NavLink>
      </nav>
      <div style={{ marginTop: 'auto', padding: '1rem' }}>
        {logoutMessage ? (
          <p role="status" className="logout-feedback" style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: 'var(--ok)' }}>
            Disconnessione effettuata
          </p>
        ) : (
          <button type="button" className="brutal-btn" onClick={handleLogout} style={{ width: '100%', fontSize: '0.75rem' }}>
            Logout
          </button>
        )}
      </div>
    </aside>
  );
}
