import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import AdminLogin, { isAdminLoggedIn } from './AdminLogin';
import { isSafeAdminRedirectPath } from './utils/adminRedirect';
import AuthVerify from './pages/AuthVerify';
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
import ABTests from './pages/ABTests';
import GenerateABTest from './pages/GenerateABTest';
import DocContent from './pages/DocContent';
import ProductImprovement from './pages/ProductImprovement';
import BrandAwareness from './pages/BrandAwareness';
import TouchpointFunnel from './pages/TouchpointFunnel';
import Notifications from './pages/Notifications';
import ExternalDesignSystems from './pages/ExternalDesignSystems';
import GenerateConversations from './pages/GenerateConversations';
import GenerateGovernance from './pages/GenerateGovernance';
import UICorpus from './pages/UICorpus';
import { InactivityTimerBadge } from './components/InactivityTimerBadge';
import { touchAdminActivity } from './lib/adminIdle';
import { useIdleAutoLogout } from './useIdleAutoLogout';

/** Dopo login o con `?redirect=/path` da Discord: porta alla pagina fonte. */
function PostLoginRedirect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const q = searchParams.get('redirect');
    if (q && isSafeAdminRedirectPath(q)) {
      navigate(q, { replace: true });
      return;
    }
    const s = sessionStorage.getItem('admin_redirect_after_login');
    if (s && isSafeAdminRedirectPath(s)) {
      sessionStorage.removeItem('admin_redirect_after_login');
      navigate(s, { replace: true });
    }
  }, [navigate, searchParams]);

  return null;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setAuthenticated(isAdminLoggedIn());
    setChecking(false);
  }, []);

  useIdleAutoLogout(authenticated);

  useEffect(() => {
    if (authenticated) {
      touchAdminActivity();
    }
  }, [authenticated]);

  useEffect(() => {
    if (authenticated && mainRef.current) {
      mainRef.current.focus({ preventScroll: true });
    }
  }, [authenticated]);

  if (checking) return null;
  if (!authenticated) {
    return (
      <Routes>
        <Route path="/auth/verify" element={<AuthVerify onSuccess={() => setAuthenticated(true)} />} />
        <Route path="*" element={<AdminLogin onSuccess={() => setAuthenticated(true)} />} />
      </Routes>
    );
  }

  return (
    <div className="layout">
      <PostLoginRedirect />
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
          <Route path="/auth/verify" element={<Navigate to="/" replace />} />
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
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/design-systems/external" element={<ExternalDesignSystems />} />
          <Route path="/generate-conversations" element={<GenerateConversations />} />
          <Route path="/generate-governance" element={<GenerateGovernance />} />
          <Route path="/generate-corpus" element={<UICorpus />} />
          <Route path="/executions" element={<Executions />} />
          <Route path="/discounts" element={<Discounts />} />
          <Route path="/ab-tests" element={<ABTests />}>
            <Route index element={<Navigate to="generate" replace />} />
            <Route path="generate" element={<GenerateABTest />} />
          </Route>
          <Route path="/content/documentation" element={<DocContent />} />
          <Route path="/content/product-improvement" element={<ProductImprovement />} />
          <Route path="/brand-awareness" element={<BrandAwareness />} />
          <Route path="/brand-awareness/funnel" element={<TouchpointFunnel />} />
        </Routes>
      </main>
      </div>
      <InactivityTimerBadge />
    </div>
  );
}
