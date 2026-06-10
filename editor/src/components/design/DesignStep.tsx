import { useEffect, useState } from 'react';
import { api } from '../../api';
import ThemePreview, { type StyleGuidePreview } from './ThemePreview';

interface Props {
  siteId: string;
  siteName: string;
  onComplete: () => void;
  onSkip?: () => void;
}

export default function DesignStep({ siteId, siteName, onComplete }: Props) {
  const [themes, setThemes] = useState<Array<{ id: string; name: string; desc: string; aesthetic: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<StyleGuidePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listDesignThemes().then((r) => setThemes(r.themes)).catch((e) => setError(e.message));
  }, []);

  async function selectTheme(themeId: string) {
    setSelectedId(themeId);
    setLoading(true);
    setError('');
    try {
      const res = await api.previewDesignTheme(siteId, themeId);
      setPreview(res.styleGuide);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  }

  async function applyTheme() {
    if (!selectedId) return;
    setApplying(true);
    setError('');
    try {
      await api.applyDesignTheme(siteId, selectedId);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="dash-page design-step">
      <h2 className="dash-page__title">Choose a design for {siteName}</h2>
      <p className="dash-page__muted">
        Pick a style guide before building pages. This flows into AI prompts and published output.
      </p>

      {error && <p className="dash-page__error">{error}</p>}

      <div className="design-step__layout">
        <div className="design-step__themes">
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Themes</h3>
          <ul className="design-theme-list">
            {themes.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`design-theme-list__item${selectedId === t.id ? ' design-theme-list__item--active' : ''}`}
                  onClick={() => void selectTheme(t.id)}
                >
                  <strong>{t.name}</strong>
                  <span>{t.desc}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="design-step__preview">
          {loading && <p className="dash-page__muted">Loading preview…</p>}
          {!loading && preview && <ThemePreview guide={preview} />}
          {!loading && !preview && (
            <p className="dash-page__muted">Select a theme to preview.</p>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
        <button type="button" disabled={!selectedId || applying} onClick={() => void applyTheme()}>
          {applying ? 'Saving…' : 'Use this theme'}
        </button>
        <button type="button" className="secondary" onClick={onComplete}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
