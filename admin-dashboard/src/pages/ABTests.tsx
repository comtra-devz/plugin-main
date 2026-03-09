import { Outlet, NavLink, Navigate } from 'react-router-dom';

export default function ABTests() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title" style={{ margin: 0 }}>A/B Tests</h1>
      </div>
      <nav className="sub-nav" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <NavLink
          to="/ab-tests/generate"
          className={({ isActive }) => `brutal-btn ${isActive ? 'active' : ''}`}
          style={{ fontSize: '0.85rem', textDecoration: 'none' }}
        >
          Generate (A vs B)
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
