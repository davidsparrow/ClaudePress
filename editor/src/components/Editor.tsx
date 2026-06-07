import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  getToken,
  type Site,
  type ContentSlot,
  type SlotChange,
  type SiteVersion,
} from '../api';
import SeoPromptsPanel from './SeoPromptsPanel';

interface Props {
  siteId: string;
  onBack: () => void;
  onLogout: () => void;
}

export default function Editor({ siteId, onBack, onLogout }: Props) {
  const [site, setSite] = useState<Site | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editHref, setEditHref] = useState('');
  const [editAlt, setEditAlt] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [versions, setVersions] = useState<SiteVersion[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showSeo, setShowSeo] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activePage = site?.pages.find((p) => p.id === activePageId) ?? null;
  const activeSlot = activePage?.content.slots[activeSlotId ?? ''] ?? null;

  const loadSite = useCallback(async () => {
    try {
      const data = await api.getSite(siteId);
      setSite(data);
      if (!activePageId && data.pages.length > 0) {
        setActivePageId(data.pages[0].id);
      }
      const vers = await api.listVersions(siteId);
      setVersions(vers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load site');
    }
  }, [siteId, activePageId]);

  useEffect(() => {
    loadSite();
  }, [loadSite]);

  useEffect(() => {
    if (!activePage) return;
    fetch(`/api/sites/${siteId}/pages/${activePage.id}/preview`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.text())
      .then(setPreviewHtml)
      .catch(() => setError('Preview load failed'));
  }, [activePage, siteId]);

  useEffect(() => {
    if (activeSlot) {
      setEditValue(activeSlot.value);
      setEditHref(activeSlot.href ?? '');
      setEditAlt(activeSlot.alt ?? '');
    }
  }, [activeSlot]);

  function selectSlot(slot: ContentSlot) {
    setActiveSlotId(slot.id);
  }

  async function saveSlot() {
    if (!activePage || !activeSlotId) return;
    setError('');
    setStatus('Saving…');

    const changes: SlotChange[] = [{ slotId: activeSlotId, value: editValue }];
    if (activeSlot?.type === 'link') changes[0].href = editHref;
    if (activeSlot?.type === 'image') changes[0].alt = editAlt;

    try {
      const { page, html } = await api.updatePage(siteId, activePage.id, changes);
      setSite((s) =>
        s ? { ...s, pages: s.pages.map((p) => (p.id === page.id ? page : p)) } : s
      );
      setPreviewHtml(html);
      setStatus('Saved');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setStatus('');
    }
  }

  async function snapshotVersion() {
    try {
      const v = await api.createVersion(siteId, `Edit ${new Date().toLocaleString()}`);
      setVersions((vs) => [v, ...vs]);
      setStatus('Snapshot saved');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Snapshot failed');
    }
  }

  async function publishSite() {
    try {
      setStatus('Publishing…');
      const result = await api.publish(siteId, `Publish ${new Date().toLocaleString()}`);
      const url = result.deploymentUrl ?? result.publish.deploymentUrl;
      setStatus(url ? `Published → ${url}` : 'Published locally');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
      setStatus('');
    }
  }

  async function rollback(versionId: string) {
    if (!confirm('Restore this version? Current unsaved edits will be replaced.')) return;
    try {
      const restored = await api.restoreVersion(siteId, versionId);
      setSite(restored);
      setStatus('Version restored');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    }
  }

  async function downloadWordPress() {
    if (!site?.meta.name) return;
    setError('');
    setStatus('Building theme…');
    try {
      await api.downloadWordPressTheme(siteId, site.meta.name);
      setStatus('WordPress theme downloaded');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WordPress export failed');
      setStatus('');
    }
  }

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!activePage || !chatInput.trim()) return;
    setError('');
    setStatus('Thinking…');
    try {
      const result = await api.chat(siteId, activePage.id, chatInput.trim());
      setSite((s) =>
        s ? { ...s, pages: s.pages.map((p) => (p.id === result.page.id ? result.page : p)) } : s
      );
      setPreviewHtml(result.html);
      setChatInput('');
      setStatus(result.explanation);
      setTimeout(() => setStatus(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
      setStatus('');
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="secondary" onClick={onBack}>
          ← Back
        </button>
        <h1>{site?.meta.name ?? 'Editor'}</h1>
        <div className="spacer" />
        {status && <span className="status-ok">{status}</span>}
        <button className="secondary" onClick={snapshotVersion}>
          Snapshot
        </button>
        <button onClick={publishSite}>Publish</button>
        <button className="secondary" onClick={downloadWordPress}>
          WordPress
        </button>
        <button className="secondary" onClick={() => setShowSeo(true)}>
          SEO prompts
        </button>
        <button className="secondary" onClick={onLogout}>
          Sign out
        </button>
      </header>

      {error && (
        <div className="error-banner" style={{ margin: '0.75rem 1rem 0' }}>
          {error}
        </div>
      )}

      <div className="editor-layout">
        <aside className="sidebar">
          <div>
            <h2>Pages</h2>
            <div className="page-tabs" style={{ marginTop: '0.5rem' }}>
              {site?.pages.map((page) => (
                <button
                  key={page.id}
                  className={`page-tab ${page.id === activePageId ? 'active' : ''}`}
                  onClick={() => {
                    setActivePageId(page.id);
                    setActiveSlotId(null);
                  }}
                >
                  {page.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2>Content slots</h2>
            <ul className="slot-list">
              {activePage?.content.slotOrder.map((id) => {
                const slot = activePage.content.slots[id];
                return (
                  <li
                    key={id}
                    className={`slot-item ${id === activeSlotId ? 'active' : ''}`}
                    onClick={() => selectSlot(slot)}
                  >
                    <div className="tag">
                      {slot.type} · {slot.tag}
                    </div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {slot.value.slice(0, 60)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {versions.length > 0 && (
            <div>
              <h2>Versions</h2>
              <ul className="slot-list">
                {versions.slice(0, 5).map((v) => (
                  <li key={v.id} className="slot-item" onClick={() => rollback(v.id)}>
                    <div>{v.label}</div>
                    <div className="tag">{new Date(v.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form className="chat-box" onSubmit={sendChat}>
            <h2>AI chat</h2>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Describe a change in plain English…"
            />
            <button type="submit" style={{ marginTop: '0.5rem', width: '100%' }} disabled={!chatInput.trim()}>
              Apply with Guardian
            </button>
            <div className="hint">AI proposes content-only changes — Guardian validates before saving.</div>
          </form>
        </aside>

        <main className="preview-pane">
          <div className="preview-toolbar">
            Live preview · click a slot in the sidebar to edit
            {activePage && <span> · {activePage.path}</span>}
          </div>
          <iframe
            ref={iframeRef}
            className="preview-frame"
            srcDoc={previewHtml}
            title="Preview"
            sandbox="allow-same-origin"
          />

          {activeSlot && (
            <div className="edit-panel">
              <h3>
                Edit {activeSlot.type} ({activeSlot.tag})
              </h3>
              <div className="form-group">
                <label>Value</label>
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={3}
                />
              </div>
              {activeSlot.type === 'link' && (
                <div className="form-group">
                  <label>Link URL</label>
                  <input value={editHref} onChange={(e) => setEditHref(e.target.value)} />
                </div>
              )}
              {activeSlot.type === 'image' && (
                <div className="form-group">
                  <label>Alt text</label>
                  <input value={editAlt} onChange={(e) => setEditAlt(e.target.value)} />
                </div>
              )}
              <div className="edit-actions">
                <button onClick={saveSlot}>Save change</button>
                <button className="secondary" onClick={() => setActiveSlotId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {showSeo && (
        <div className="seo-modal-backdrop" onClick={() => setShowSeo(false)}>
          <div className="seo-modal" onClick={(e) => e.stopPropagation()}>
            <SeoPromptsPanel
              siteId={siteId}
              pageId={activePageId ?? undefined}
              onClose={() => setShowSeo(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
