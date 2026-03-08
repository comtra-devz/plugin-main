import { NavLink } from 'react-router-dom';
import { logout } from './AdminLogin';

export default function Sidebar() {
  return (
    <aside className="sidebar">
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
        <NavLink to="/affiliates" className={({ isActive }) => (isActive ? 'active' : '')}>
          Affiliati
        </NavLink>
        <NavLink to="/discounts" className={({ isActive }) => (isActive ? 'active' : '')}>
          Codici sconto
        </NavLink>
      </nav>
      <div style={{ marginTop: 'auto', padding: '1rem' }}>
        <button type="button" className="brutal-btn" onClick={logout} style={{ width: '100%', fontSize: '0.75rem' }}>
          Logout
        </button>
      </div>
    </aside>
  );
}
