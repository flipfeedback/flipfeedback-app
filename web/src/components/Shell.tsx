import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Shell() {
  const { session, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Flip<span>Feedback</span>
        </div>
        <nav>
          <NavLink to="/inbox" className={({ isActive }) => (isActive ? 'active' : '')}>
            Inbox
          </NavLink>
          <NavLink to="/triage" className={({ isActive }) => (isActive ? 'active' : '')}>
            Triage
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => (isActive ? 'active' : '')}>
            Analytics
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            Settings
          </NavLink>
        </nav>
        <div className="spacer" />
        <div className="who">
          {session?.user.name}
          <br />
          {session?.organization.name}
        </div>
        <button onClick={logout}>Sign out</button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
