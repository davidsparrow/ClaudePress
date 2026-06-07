import { useCallback, useEffect, useState } from 'react';
import { api, type SiteMeta } from '../api';
import { useDashboard } from '../context/DashboardContext';
import type { AdminSection } from '../context/dashboardTypes';
import Editor from '../components/Editor';
import Sidebar from './Sidebar';
import OverviewPage from '../pages/OverviewPage';
import PagesPage from '../pages/PagesPage';
import PlaceholderPage from '../pages/PlaceholderPage';
import SettingsPage from '../pages/SettingsPage';
import AdminPage from '../pages/admin/AdminPage';

interface Props {
  onLogout: () => void;
}

export default function DashboardShell({ onLogout }: Props) {
  const {
    selectedSiteId,
    sidebarMode,
    activeSiteSection,
    activeAdminSection,
    selectSite,
    setActiveSiteSection,
    validateSelectedSite,
    setSidebarCollapsed,
  } = useDashboard();

  const [sites, setSites] = useState<SiteMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddSite, setShowAddSite] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');

  const refreshSites = useCallback(() => {
    return api
      .listSites()
      .then((list) => {
        setSites(list);
        validateSelectedSite(list.map((s) => s.id));
        return list;
      })
      .catch((e) => setError(e.message));
  }, [validateSelectedSite]);

  useEffect(() => {
    refreshSites().finally(() => setLoading(false));
  }, [refreshSites]);

  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? null;
  const editorFocus = sidebarMode === 'sites' && activeSiteSection === 'editor' && !!selectedSiteId;

  useEffect(() => {
    if (editorFocus) setSidebarCollapsed(true);
  }, [editorFocus, setSidebarCollapsed]);

  async function handleCreateSite(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const site = await api.createSite(newName.trim(), newDomain.trim() || undefined);
      setSites((s) => [site.meta, ...s]);
      selectSite(site.meta.id);
      setNewName('');
      setNewDomain('');
      setShowAddSite(false);
      setActiveSiteSection('overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  function handleImported(siteId: string) {
    void refreshSites().then(() => {
      selectSite(siteId);
      setActiveSiteSection('overview');
    });
  }

  function renderAdminContent() {
    const common: Record<AdminSection, { title: string; description: string; body: React.ReactNode }> = {
      workspace: {
        title: 'Workspace',
        description: 'Agency name, timezone, and workspace overview.',
        body: <p>Agency name and default timezone — TODO.</p>,
      },
      users: {
        title: 'Users',
        description: 'Admin and team users for this PressPal workspace.',
        body: <p>Team user management — TODO.</p>,
      },
      'client-access': {
        title: 'Client Access',
        description: 'Overview of client access across all sites.',
        body: (
          <p>
            Per-site invites live under <strong>Site Settings → Access</strong>. This page will show a
            cross-site overview — TODO.
          </p>
        ),
      },
      integrations: {
        title: 'Integrations',
        description: 'Vercel, TinyPNG, Cloudinary, imgix, and other providers.',
        body: <p>Integration placeholders — TODO.</p>,
      },
      email: {
        title: 'Email / Resend',
        description: 'Workspace email defaults (not the source of truth yet).',
        body: (
          <>
            <p>
              Email delivery is configured <strong>per site</strong> today via{' '}
              <code>SiteEmailConfig</code>. This admin page will hold workspace defaults and “apply to new
              sites” — TODO.
            </p>
            <p>Do not migrate per-site keys here without an explicit workspace storage model.</p>
          </>
        ),
      },
      'ai-providers': {
        title: 'AI Providers',
        description: 'Claude, OpenAI, Gemini BYOK placeholders.',
        body: <p>AI provider configuration — TODO.</p>,
      },
      billing: {
        title: 'Billing',
        description: 'Subscription and usage.',
        body: <p>Billing — TODO.</p>,
      },
      defaults: {
        title: 'Defaults',
        description: 'Default Guardian rules, SEO defaults, media limits.',
        body: <p>Workspace defaults — TODO.</p>,
      },
      security: {
        title: 'Security',
        description: '2FA, login history, audit log.',
        body: <p>Security settings — TODO.</p>,
      },
    };
    const page = common[activeAdminSection];
    return (
      <AdminPage title={page.title} description={page.description}>
        {page.body}
      </AdminPage>
    );
  }

  function renderSiteContent() {
    if (!selectedSiteId) {
      return (
        <OverviewPage
          siteId={null}
          onSiteCreated={() => void refreshSites()}
          onImported={handleImported}
          onError={setError}
        />
      );
    }

    switch (activeSiteSection) {
      case 'overview':
        return (
          <OverviewPage
            siteId={selectedSiteId}
            siteName={selectedSite?.name}
            onSiteCreated={() => void refreshSites()}
            onImported={handleImported}
            onError={setError}
          />
        );
      case 'editor':
        return null;
      case 'pages':
        return <PagesPage siteId={selectedSiteId} />;
      case 'media':
        return (
          <PlaceholderPage
            title="Media"
            description="Guarded Media — browse imported assets (Phase 8)."
          />
        );
      case 'forms':
        return (
          <PlaceholderPage
            title="PressPal Forms"
            description="Contact form and submissions inbox (Phase 7)."
          />
        );
      case 'seo':
        return (
          <PlaceholderPage
            title="SEO"
            description="Page SEO fields and React SEO prompts (Phase 10)."
          />
        );
      case 'publishes':
        return (
          <PlaceholderPage
            title="Publishes"
            description="Publish history and deployment targets."
          />
        );
      case 'snapshots':
        return (
          <PlaceholderPage
            title="Snapshots"
            description="Immutable publish snapshots and rollback (Phase 9)."
          />
        );
      case 'settings':
        return <SettingsPage siteId={selectedSiteId} />;
      default:
        return null;
    }
  }

  const addSiteForm = (
    <form className="dash-sidebar__add-form" onSubmit={handleCreateSite}>
      <input
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Site name"
        required
      />
      <input
        value={newDomain}
        onChange={(e) => setNewDomain(e.target.value)}
        placeholder="Domain (optional)"
      />
      <button type="submit">Create</button>
    </form>
  );

  return (
    <div className={`dashboard-shell${editorFocus ? ' dashboard-shell--editor-focus' : ''}`}>
      <Sidebar
        sites={sites}
        loading={loading}
        onAddSite={() => setShowAddSite((v) => !v)}
        showAddSite={showAddSite}
        addSiteForm={addSiteForm}
      />

      <div className="dashboard-main">
        <header className="topbar">
          <h1>
            {editorFocus
              ? `Editing — ${selectedSite?.name ?? 'Site'}`
              : sidebarMode === 'admin'
                ? 'PressPal Admin'
                : 'PressPal Dashboard'}
          </h1>
          <div className="spacer" />
          {editorFocus && (
            <button
              type="button"
              className="secondary"
              onClick={() => setActiveSiteSection('overview')}
            >
              Back to Overview
            </button>
          )}
          <button type="button" className="secondary" onClick={onLogout}>
            Sign out
          </button>
        </header>

        {error && !editorFocus && <div className="error-banner dashboard-main__error">{error}</div>}

        <div className="dashboard-main__content">
          {editorFocus && selectedSiteId ? (
            <Editor
              siteId={selectedSiteId}
              onBack={() => setActiveSiteSection('overview')}
              onLogout={onLogout}
              embedded
            />
          ) : sidebarMode === 'admin' ? (
            renderAdminContent()
          ) : (
            renderSiteContent()
          )}
        </div>
      </div>
    </div>
  );
}
