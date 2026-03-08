import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin, { isAdminLoggedIn } from './AdminLogin';
import Sidebar from './Sidebar';
import Home from './pages/Home';
import Users from './pages/Users';
import Credits from './pages/Credits';
import Affiliates from './pages/Affiliates';
import WeeklyUpdates from './pages/WeeklyUpdates';
import SupportRequests from './pages/SupportRequests';
import SecurityLogs from './pages/SecurityLogs';
import Health from './pages/Health';
import Executions from './pages/Executions';
import Discounts from './pages/Discounts';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setAuthenticated(isAdminLoggedIn());
    setChecking(false);
  }, []);

  useEffect(() => {
    if (authenticated && mainRef.current) {
      mainRef.current.focus({ preventScroll: true });
    }
  }, [authenticated]);

  if (checking) return null;
  if (!authenticated) {
    return <AdminLogin onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div className="layout">
      <a href="#main-content" className="skip-link">Vai al contenuto</a>
      <div
        className="sidebar-backdrop"
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
        style={{ display: sidebarOpen ? 'block' : 'none' }}
      />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-wrap">
        <header className="mobile-header" aria-label="Menu principale">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Apri menu"
          >
            <span aria-hidden="true">☰</span>
          </button>
          <span className="mobile-header-title">Comtra Admin</span>
        </header>
      <main id="main-content" className="main" ref={mainRef} tabIndex={-1} aria-label="Contenuto principale">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/charts" element={<Home />} />
          <Route path="/users" element={<Users />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/token-usage" element={<Navigate to="/credits" replace />} />
          <Route path="/affiliates" element={<Affiliates />} />
          <Route path="/weekly-updates" element={<WeeklyUpdates />} />
          <Route path="/support" element={<SupportRequests />} />
          <Route path="/security" element={<SecurityLogs />} />
          <Route path="/health" element={<Health />} />
          <Route path="/executions" element={<Executions />} />
          <Route path="/discounts" element={<Discounts />} />
        </Routes>
      </main>
      </div>
    </div>
  );
}
