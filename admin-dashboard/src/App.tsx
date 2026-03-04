import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import AdminLogin, { isAdminLoggedIn } from './AdminLogin';
import Sidebar from './Sidebar';
import Home from './pages/Home';
import Users from './pages/Users';
import Credits from './pages/Credits';
import Affiliates from './pages/Affiliates';
import TokenUsage from './pages/TokenUsage';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setAuthenticated(isAdminLoggedIn());
    setChecking(false);
  }, []);

  if (checking) return null;
  if (!authenticated) {
    return <AdminLogin onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/users" element={<Users />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/token-usage" element={<TokenUsage />} />
          <Route path="/affiliates" element={<Affiliates />} />
        </Routes>
      </main>
    </div>
  );
}
