import { Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Users from './pages/Users';
import Credits from './pages/Credits';
import Affiliates from './pages/Affiliates';
import TokenUsage from './pages/TokenUsage';

function Nav() {
  return (
    <nav className="nav">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        Home
      </NavLink>
      <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>
        Utenti
      </NavLink>
      <NavLink to="/credits" className={({ isActive }) => (isActive ? 'active' : '')}>
        Crediti e costi
      </NavLink>
      <NavLink to="/token-usage" className={({ isActive }) => (isActive ? 'active' : '')}>
        Token Kimi
      </NavLink>
      <NavLink to="/affiliates" className={({ isActive }) => (isActive ? 'active' : '')}>
        Affiliati
      </NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <div className="layout">
      <Nav />
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
