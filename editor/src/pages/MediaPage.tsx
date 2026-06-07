import { useEffect, useMemo, useState } from 'react';
import { api, type MediaAsset } from '../api';

interface Props {
  siteId: string;
}

function sourceLabel(asset: MediaAsset): string {
  if (asset.wpPostId != null) return 'WordPress import';
  return 'Imported';
}

export default function MediaPage({ siteId }: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [search, setSearch] = useState('');
  const [mimeFilter, setMimeFilter] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .listMedia(siteId)
      .then(setAssets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [siteId]);

  const mimeTypes = useMemo(() => {
    const set = new Set(assets.map((a) => a.mimeType).filter(Boolean) as string[]);
    return [...set].sort();
  }, [assets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (mimeFilter && a.mimeType !== mimeFilter) return false;
      if (!q) return true;
      const haystack = [
        a.filename,
        a.publicPath,
        a.relativePath,
        a.sourceUrl,
        sourceLabel(a),
        a.mimeType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [assets, search, mimeFilter]);

  if (loading) return <p className="dash-page__muted">Loading media…</p>;
  if (error) return <div className="error-banner">{error}</div>;

  return (
    <div className="dash-page">
      <h2 className="dash-page__title">Guarded Media</h2>
      <p className="dash-page__muted">
        Browse media imported for this site. Upload, optimization, alt text, dimensions, and safe image
        replacement are coming in Guarded Media Stage 2.
      </p>

      <div className="media-toolbar panel">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search filename, path, URL, type…"
          style={{ flex: '1 1 200px' }}
        />
        <select
          value={mimeFilter}
          onChange={(e) => setMimeFilter(e.target.value)}
          style={{
            flex: '0 0 160px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            padding: '0.5rem',
          }}
        >
          <option value="">All types</option>
          {mimeTypes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="dash-page__muted" style={{ margin: 0, whiteSpace: 'nowrap' }}>
          {filtered.length} of {assets.length}
        </span>
      </div>

      {assets.length === 0 ? (
        <div className="panel dash-placeholder" style={{ marginTop: '1rem' }}>
          <p>No media yet. Media uploads and optimization are coming soon.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel dash-placeholder" style={{ marginTop: '1rem' }}>
          <p>No media matches your search.</p>
        </div>
      ) : (
        <div className="media-grid">
          {filtered.map((asset) => (
            <article key={asset.id} className="panel media-card">
              <div className="media-card__preview">
                {asset.mimeType?.startsWith('image/') ? (
                  <img src={asset.publicPath} alt="" loading="lazy" />
                ) : (
                  <span className="media-card__file-icon">📄</span>
                )}
              </div>
              <h3 className="media-card__title">{asset.filename}</h3>
              <dl className="media-card__meta">
                <dt>Source</dt>
                <dd>{sourceLabel(asset)}</dd>
                <dt>MIME type</dt>
                <dd>{asset.mimeType ?? 'Unknown'}</dd>
                <dt>File size</dt>
                <dd>Unknown</dd>
                <dt>Dimensions</dt>
                <dd>Unknown</dd>
                <dt>Alt text</dt>
                <dd className="media-card__placeholder">Not tracked yet</dd>
                <dt>Caption</dt>
                <dd className="media-card__placeholder">Not tracked yet</dd>
                <dt>Usage</dt>
                <dd className="media-card__placeholder">Not tracked yet</dd>
              </dl>
              {asset.sourceUrl && (
                <p className="media-card__url hint">
                  <a href={asset.sourceUrl} target="_blank" rel="noreferrer">
                    Original URL
                  </a>
                </p>
              )}
              <code className="media-card__path">{asset.publicPath}</code>
            </article>
          ))}
        </div>
      )}

      <div className="panel media-future" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Coming in Stage 2</h3>
        <ul className="media-future__list">
          <li>Upload images</li>
          <li>Compress automatically</li>
          <li>Generate WebP / AVIF</li>
          <li>TinyPNG / Cloudinary / imgix integrations</li>
          <li>Replace image slots safely</li>
        </ul>
        <p className="hint" style={{ margin: '0.75rem 0 0' }}>
          See <code>docs/guarded-media-stage-2.md</code> for the planned pipeline.
        </p>
      </div>
    </div>
  );
}
