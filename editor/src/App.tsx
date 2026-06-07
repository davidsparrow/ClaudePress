import { useState } from 'react';
import { setToken, clearToken } from './api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';

type View =
  | { kind: 'login' }
  | { kind: 'dashboard' }
  | { kind: 'editor'; siteId: string };

export default function App() {
  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    const siteId = params.get('site');
    if (siteId) return { kind: 'editor', siteId };
    return { kind: 'login' };
  });

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

  if (view.kind === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  if (view.kind === 'dashboard') {
    return (
      <Dashboard
        onOpenSite={(siteId) => setView({ kind: 'editor', siteId })}
        onLogout={handleLogout}
      />
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
