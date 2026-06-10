import { useEffect, useState } from 'react';
import { getToken, setToken, clearToken } from './api';
import { DashboardProvider } from './context/DashboardContext';
import Login from './components/Login';
import DashboardShell from './layout/DashboardShell';
import Editor from './components/Editor';

type View =
  | { kind: 'login' }
  | { kind: 'dashboard' }
  | { kind: 'editor'; siteId: string };

function initialView(): View {
  const siteId = new URLSearchParams(window.location.search).get('site');
  if (siteId) return { kind: 'editor', siteId };
  return { kind: 'login' };
}

export default function App() {
  const [view, setView] = useState<View>(initialView);
  const [restoring, setRestoring] = useState(() => getToken() !== null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setRestoring(false);
      return;
    }

    const siteId = new URLSearchParams(window.location.search).get('site');
    const path = siteId ? `/api/sites/${siteId}` : '/api/sites';

    fetch(path, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error('Session expired');
        if (siteId) setView({ kind: 'editor', siteId });
        else setView({ kind: 'dashboard' });
      })
      .catch(() => {
        clearToken();
        setView({ kind: 'login' });
      })
      .finally(() => setRestoring(false));
  }, []);

  function handleLogin(token: string, siteId?: string) {
    setToken(token);
    if (siteId) {
      setView({ kind: 'editor', siteId });
    } else {
      setView({ kind: 'dashboard' });
    }
  }

  function handleLogout() {
    clearToken();
    setView({ kind: 'login' });
  }

  if (restoring) {
    return (
      <div className="login-page">
        <p style={{ color: 'var(--muted)' }}>Restoring session…</p>
      </div>
    );
  }

  if (view.kind === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  if (view.kind === 'dashboard') {
    return (
      <DashboardProvider>
        <DashboardShell onLogout={handleLogout} />
      </DashboardProvider>
    );
  }

  return (
    <Editor
      siteId={view.siteId}
      onBack={() => setView({ kind: 'dashboard' })}
      onLogout={handleLogout}
    />
  );
}
