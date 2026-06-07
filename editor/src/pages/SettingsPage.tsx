import { useEffect, useState } from 'react';
import { api, type SiteMeta, type SiteVersion } from '../api';

interface Props {
  siteId: string;
}

interface PublishRow {
  id: string;
  label: string;
  createdAt: string;
  deploymentUrl?: string;
}

export default function SettingsPage({ siteId }: Props) {
  const [meta, setMeta] = useState<SiteMeta | null>(null);
  const [versions, setVersions] = useState<SiteVersion[]>([]);
  const [publishes, setPublishes] = useState<PublishRow[]>([]);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getSite(siteId).then((s) => s.meta),
      api.listVersions(siteId),
      api.listPublishes(siteId),
    ])
      .then(([m, v, p]) => {
        setMeta(m);
        setVersions(v);
        setPublishes(p);
      })
      .catch((e) => setError(e.message));
  }, [siteId]);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setError('');
    setStatus('Saving…');
    try {
      await api.setPassword(siteId, password.trim());
      setPassword('');
      setStatus('Client password updated');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save password');
      setStatus('');
    }
  }

  if (error && !meta) return <div className="error-banner">{error}</div>;
  if (!meta) return <p className="dash-page__muted">Loading settings…</p>;

  const latestPublish = publishes[0];
  const latestVersion = versions[0];

  return (
    <div className="dash-page">
      <h2 className="dash-page__title">Site Settings</h2>
      <p className="dash-page__muted">Settings for {meta.name} — not workspace admin.</p>
      {error && <div className="error-banner">{error}</div>}
      {status && <p className="status-ok">{status}</p>}

      <div className="settings-grid">
        <section className="panel settings-card">
          <h3>Site Identity</h3>
          <dl className="settings-dl">
            <dt>Name</dt>
            <dd>{meta.name}</dd>
            <dt>Live domain</dt>
            <dd>{meta.domain ?? '—'}</dd>
            <dt>Site ID</dt>
            <dd><code>{meta.id}</code></dd>
          </dl>
        </section>

        <section className="panel settings-card">
          <h3>Publishing</h3>
          <dl className="settings-dl">
            <dt>Provider</dt>
            <dd>Vercel / static (configure via publish)</dd>
            <dt>Last publish</dt>
            <dd>{latestPublish ? new Date(latestPublish.createdAt).toLocaleString() : '—'}</dd>
            <dt>Status</dt>
            <dd>{latestPublish?.deploymentUrl ? 'Deployed' : publishes.length ? 'Local snapshot' : 'Not published'}</dd>
            <dt>Target</dt>
            <dd>{latestPublish?.deploymentUrl ?? meta.domain ?? '—'}</dd>
          </dl>
        </section>

        <section className="panel settings-card">
          <h3>Snapshots</h3>
          <dl className="settings-dl">
            <dt>Latest</dt>
            <dd>{latestVersion ? `${latestVersion.label} (${new Date(latestVersion.createdAt).toLocaleString()})` : '—'}</dd>
            <dt>Count</dt>
            <dd>{versions.length}</dd>
            <dt>Rollback</dt>
            <dd>Available via Snapshots section</dd>
          </dl>
        </section>

        <section className="panel settings-card">
          <h3>Metadata</h3>
          <p className="dash-page__muted">Default SEO title, meta description, and OpenGraph image — TODO.</p>
        </section>

        <section className="panel settings-card">
          <h3>Forms / Email</h3>
          <p className="dash-page__muted">
            Manage form behavior in <strong>Forms</strong>. Per-site Resend delivery config will live here under Email — TODO (Phase 7).
          </p>
        </section>

        <section className="panel settings-card">
          <h3>Access</h3>
          <p className="dash-page__muted">Set a client password for site-scoped editor access.</p>
          <form onSubmit={savePassword} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New client password"
              style={{ flex: '1 1 200px' }}
            />
            <button type="submit">Save password</button>
          </form>
          <p className="dash-page__muted" style={{ marginTop: '0.75rem' }}>
            Client invite email — TODO (Phase 7, moved from Email modal).
          </p>
        </section>

        <section className="panel settings-card settings-card--danger">
          <h3>Danger Zone</h3>
          <p className="dash-page__muted">Archive and delete are disabled for now.</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" className="secondary" disabled>
              Archive site
            </button>
            <button type="button" className="danger" disabled>
              Delete site
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
