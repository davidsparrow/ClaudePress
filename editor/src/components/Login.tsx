import { useState } from 'react';

interface Props {
  onLogin: (token: string, siteId?: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [mode, setMode] = useState<'owner' | 'client'>('owner');
  const [token, setTokenInput] = useState('');
  const [siteId, setSiteId] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!token.trim()) {
      setError('Please enter your access key or password.');
      return;
    }

    if (mode === 'client' && !siteId.trim()) {
      setError('Site ID is required for client login.');
      return;
    }

    try {
      const path = mode === 'owner' ? '/sites' : `/sites/${siteId.trim()}`;
      const res = await fetch(`/api${path}`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (!res.ok) throw new Error('Invalid credentials');
      onLogin(token.trim(), mode === 'client' ? siteId.trim() : undefined);
    } catch {
      setError('Login failed — check your key/password and site ID.');
    }
  }

  return (
    <div className="login-page">
      <div className="panel">
        <h1>FreshPress</h1>
        <p>Edit your site content — design stays locked.</p>

        {error && <div className="error-banner">{error}</div>}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            className={mode === 'owner' ? '' : 'secondary'}
            onClick={() => setMode('owner')}
          >
            Owner
          </button>
          <button
            type="button"
            className={mode === 'client' ? '' : 'secondary'}
            onClick={() => setMode('client')}
          >
            Client
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'client' && (
            <div className="form-group">
              <label htmlFor="siteId">Site ID</label>
              <input
                id="siteId"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                placeholder="abc123xyz"
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="token">
              {mode === 'owner' ? 'Master key' : 'Site password'}
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={mode === 'owner' ? 'Your MASTER_KEY' : 'Client password'}
            />
          </div>
          <button type="submit" style={{ width: '100%' }}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
