import { useCallback, useEffect, useState } from 'react';
import { api, type BlogPost, type BlogSilo } from '../api';
import TipTapEditor from '../components/blog/TipTapEditor';

interface Props {
  siteId: string;
}

export default function BlogPage({ siteId }: Props) {
  const [silos, setSilos] = useState<BlogSilo[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newPillarKeyword, setNewPillarKeyword] = useState('');
  const [newPillarTitle, setNewPillarTitle] = useState('');
  const [seoRecipes, setSeoRecipes] = useState<Array<{ id: string; number: number; title: string }>>([]);
  const [seoContent, setSeoContent] = useState('');
  const [seoCopied, setSeoCopied] = useState(false);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [humanized, setHumanized] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  const [rssLabel, setRssLabel] = useState('');
  const [rssFeeds, setRssFeeds] = useState<Array<{ id: string; url: string; label: string }>>([]);

  const refresh = useCallback(() => {
    api.listBlogSilos(siteId).then(setSilos).catch((e) => setError(e.message));
  }, [siteId]);

  useEffect(() => {
    refresh();
    api.listRssFeeds(siteId).then(setRssFeeds).catch(() => setRssFeeds([]));
  }, [refresh, siteId]);

  useEffect(() => {
    if (!selectedPostId) {
      setPost(null);
      return;
    }
    api.getBlogPost(siteId, selectedPostId).then(setPost).catch((e) => setError(e.message));
    api
      .listBlogSeoRecipes(siteId, selectedPostId)
      .then((r) => setSeoRecipes(r.recipes))
      .catch(() => setSeoRecipes([]));
    setSeoContent('');
    setAiScore(null);
    setHumanized('');
  }, [siteId, selectedPostId]);

  async function createPillar(e: React.FormEvent) {
    e.preventDefault();
    if (!newPillarTitle.trim() || !newPillarKeyword.trim()) return;
    const slug = newPillarKeyword.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    try {
      const res = await api.createBlogPillar(siteId, {
        keyword: newPillarKeyword.trim(),
        slug,
        title: newPillarTitle.trim(),
      });
      setNewPillarKeyword('');
      setNewPillarTitle('');
      refresh();
      setSelectedPostId(res.pillarPost.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  async function addSupportive(pillarId: string) {
    const title = window.prompt('Supportive post title');
    if (!title?.trim()) return;
    const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    try {
      const created = await api.createSupportivePost(siteId, pillarId, { title: title.trim(), slug });
      refresh();
      setSelectedPostId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  async function savePost() {
    if (!post) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateBlogPost(siteId, post.id, {
        title: post.title,
        bodyHtml: post.bodyHtml,
        status: post.status,
        metaTitle: post.metaTitle,
        metaDescription: post.metaDescription,
      });
      setPost(updated);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dash-page blog-page">
      <h2 className="dash-page__title">Blog</h2>
      <p className="dash-page__muted">Keyword silos — pillar posts and supportive cluster articles.</p>
      {error && <p className="dash-page__error">{error}</p>}

      <div className="blog-page__layout">
        <aside className="blog-page__silos">
          <form
            className="blog-page__new-pillar"
            onSubmit={(e) => {
              e.preventDefault();
              if (!rssUrl.trim() || !rssLabel.trim()) return;
              void api.addRssFeed(siteId, rssUrl.trim(), rssLabel.trim()).then((f) => {
                setRssFeeds((prev) => [...prev, f]);
                setRssUrl('');
                setRssLabel('');
              });
            }}
          >
            <input value={rssLabel} onChange={(e) => setRssLabel(e.target.value)} placeholder="Feed label" />
            <input value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} placeholder="RSS URL" />
            <button type="submit" className="secondary">
              + RSS feed
            </button>
          </form>
          {rssFeeds.length > 0 && (
            <ul className="blog-silo__posts" style={{ marginBottom: '1rem' }}>
              {rssFeeds.map((f) => (
                <li key={f.id} className="dash-page__muted" style={{ fontSize: '0.85rem' }}>
                  {f.label}
                </li>
              ))}
            </ul>
          )}
          <form className="blog-page__new-pillar" onSubmit={createPillar}>
            <input
              value={newPillarTitle}
              onChange={(e) => setNewPillarTitle(e.target.value)}
              placeholder="Pillar title"
            />
            <input
              value={newPillarKeyword}
              onChange={(e) => setNewPillarKeyword(e.target.value)}
              placeholder="Main keyword"
            />
            <button type="submit">+ Pillar</button>
          </form>

          {silos.map(({ pillar, posts }) => (
            <div key={pillar.id} className="blog-silo">
              <div className="blog-silo__header">
                <strong>{pillar.title}</strong>
                <span className="dash-page__muted">{pillar.keyword}</span>
              </div>
              <ul className="blog-silo__posts">
                {posts.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`blog-silo__post-btn${selectedPostId === p.id ? ' blog-silo__post-btn--active' : ''}`}
                      onClick={() => setSelectedPostId(p.id)}
                    >
                      {p.kind === 'pillar' ? '★ ' : '· '}
                      {p.title}
                      <span>{p.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="secondary" onClick={() => void addSupportive(pillar.id)}>
                + Supportive
              </button>
            </div>
          ))}
        </aside>

        <main className="blog-page__editor">
          {!post && <p className="dash-page__muted">Select a post to edit.</p>}
          {post && (
            <>
              <input
                value={post.title}
                onChange={(e) => setPost({ ...post, title: e.target.value })}
                style={{ marginBottom: '0.75rem', fontSize: '1.25rem', fontWeight: 600 }}
              />
              <TipTapEditor content={post.bodyHtml} onChange={(html) => setPost({ ...post, bodyHtml: html })} />
              <div className="blog-seo-lab panel" style={{ marginTop: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>SEO Lab</h3>
                <p className="dash-page__muted" style={{ marginBottom: '0.75rem' }}>
                  Copy agent-ready recipes (On-Page.ai BYOK in Admin). Meta title/description auto-fill on save.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {seoRecipes.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="secondary"
                      onClick={() =>
                        void api.getBlogSeoRecipe(siteId, post.id, r.id).then((res) => setSeoContent(res.content))
                      }
                    >
                      #{r.number} {r.title.slice(0, 28)}
                      {r.title.length > 28 ? '…' : ''}
                    </button>
                  ))}
                </div>
                {seoContent && (
                  <>
                    <textarea readOnly value={seoContent} rows={8} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
                    <button
                      type="button"
                      className="secondary"
                      style={{ marginTop: '0.5rem' }}
                      onClick={() => {
                        void navigator.clipboard.writeText(seoContent);
                        setSeoCopied(true);
                        setTimeout(() => setSeoCopied(false), 2000);
                      }}
                    >
                      {seoCopied ? 'Copied!' : 'Copy for agent'}
                    </button>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <select
                  value={post.status}
                  onChange={(e) =>
                    setPost({
                      ...post,
                      status: e.target.value as BlogPost['status'],
                    })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                </select>
                <button type="button" onClick={() => void savePost()} disabled={saving}>
                  {saving ? 'Saving…' : 'Save post'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    void api.detectBlogAi(siteId, post.id).then((r) => setAiScore(r.score))
                  }
                >
                  Check AI {aiScore !== null ? `(${aiScore}%)` : ''}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    void api.humanizeBlogPost(siteId, post.id).then((r) => setHumanized(r.humanizedHtml))
                  }
                >
                  Humanize
                </button>
              </div>
              {humanized && (
                <div className="panel" style={{ marginTop: '1rem' }}>
                  <h4>Humanized draft</h4>
                  <div dangerouslySetInnerHTML={{ __html: humanized }} />
                  <button
                    type="button"
                    style={{ marginTop: '0.5rem' }}
                    onClick={() => setPost({ ...post, bodyHtml: humanized })}
                  >
                    Accept humanized draft
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
