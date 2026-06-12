import { useEffect, useState } from 'react';
import { getToken, setToken, clearToken, setClientSiteId, getClientSiteId } from './api';
import { DashboardProvider } from './context/DashboardContext';
import { AuthProvider, type AuthState } from './context/AuthContext';
import Login from './components/Login';
import DashboardShell from './layout/DashboardShell';
import Editor from './components/Editor';

type View =
  | { kind: 'login' }
  | { kind: 'dashboard'; initialSiteId?: string; initialSection?: 'social' }
  | { kind: 'editor'; siteId: string };

const DEFAULT_AUTH: AuthState = { role: 'admin' };

function initialView(): View {
  const siteId = new URLSearchParams(window.location.search).get('site');
  if (siteId) return { kind: 'editor', siteId };
  return { kind: 'login' };
}

export default function App() {
  const [view, setView] = useState<View>(initialView);
  const [auth, setAuth] = useState<AuthState>(DEFAULT_AUTH);
  const [restoring, setRestoring] = useState(() => getToken() !== null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setRestoring(false);
      return;
    }

    const siteId = new URLSearchParams(window.location.search).get('site') ?? getClientSiteId();

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.ok) {
          const me = (await res.json()) as AuthState;
          setAuth(me);
          if (siteId) setView({ kind: 'editor', siteId });
          else setView({ kind: 'dashboard' });
          return;
        }

        // Client password auth — not valid for /auth/me
        const clientSiteId = siteId ?? getClientSiteId();
        if (clientSiteId) {
          const siteRes = await fetch(`/api/sites/${clientSiteId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!siteRes.ok) throw new Error('Session expired');
          setAuth({ role: 'client', siteId: clientSiteId });
          setView({ kind: 'dashboard', initialSiteId: clientSiteId, initialSection: 'social' });
          return;
        }

        // Admin legacy token — try /sites
        const sitesRes = await fetch('/api/sites', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!sitesRes.ok) throw new Error('Session expired');
        setAuth({ role: 'admin' });
        setView({ kind: 'dashboard' });
      })
      .catch(() => {
        clearToken();
        setView({ kind: 'login' });
      })
      .finally(() => setRestoring(false));
  }, []);

  function handleLogin(token: string, opts?: { siteId?: string; role?: 'admin' | 'client' }) {
    setToken(token);
    const role = opts?.role ?? 'admin';
    setAuth({ role, siteId: opts?.siteId });

    if (role === 'client' && opts?.siteId) {
      setClientSiteId(opts.siteId);
      setView({ kind: 'dashboard', initialSiteId: opts.siteId, initialSection: 'social' });
    } else if (opts?.siteId) {
      setView({ kind: 'editor', siteId: opts.siteId });
    } else {
      void fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((me) => {
          if (me) setAuth(me as AuthState);
        });
      setView({ kind: 'dashboard' });
    }
  }

  function handleLogout() {
    const token = getToken();
    if (token) {
      void fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    clearToken();
    setAuth(DEFAULT_AUTH);
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

  const authValue = auth;

  if (view.kind === 'dashboard') {
    return (
      <AuthProvider value={authValue}>
        <DashboardProvider
          initialSiteId={view.initialSiteId}
          initialSiteSection={view.initialSection}
        >
          <DashboardShell onLogout={handleLogout} />
        </DashboardProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider value={authValue}>
      <Editor
        siteId={view.siteId}
        onBack={() => setView({ kind: 'dashboard' })}
        onLogout={handleLogout}
      />
    </AuthProvider>
  );
}
