export interface StyleGuidePreview {
  meta: { name: string; aesthetic: string; designPhilosophy: string };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
  };
  typography: { headingFont: string; bodyFont: string };
  components: {
    button: { primaryBg: string; primaryText: string; primaryRadius: string };
    card: { background: string; border: string; radius: string; shadow: string };
  };
}

interface Props {
  guide: StyleGuidePreview;
}

export default function ThemePreview({ guide }: Props) {
  const c = guide.colors;
  const btn = guide.components.button;
  const card = guide.components.card;

  return (
    <div
      className="theme-preview"
      style={{
        background: c.background,
        color: c.text,
        fontFamily: guide.typography.bodyFont,
        borderRadius: '12px',
        border: `1px solid ${c.border}`,
        overflow: 'hidden',
      }}
    >
      <div className="theme-preview__header" style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${c.border}` }}>
        <strong style={{ fontFamily: guide.typography.headingFont }}>{guide.meta.name}</strong>
        <p style={{ margin: '0.35rem 0 0', color: c.textMuted, fontSize: '0.9rem' }}>{guide.meta.aesthetic}</p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>{guide.meta.designPhilosophy}</p>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[c.primary, c.secondary, c.accent, c.surface, c.text].map((color) => (
          <div
            key={color}
            title={color}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: color,
              border: `1px solid ${c.border}`,
            }}
          />
        ))}
      </div>

      <div style={{ padding: '0 1.25rem 1.25rem' }}>
        <div
          style={{
            background: c.surface,
            borderRadius: card.radius,
            border: card.border,
            boxShadow: card.shadow,
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem', fontFamily: guide.typography.headingFont, fontSize: '1.5rem' }}>
            Ship faster.
          </h3>
          <p style={{ margin: '0 0 1rem', color: c.textMuted }}>Preview headline and body using this style guide.</p>
          <button
            type="button"
            style={{
              background: btn.primaryBg,
              color: btn.primaryText,
              borderRadius: btn.primaryRadius,
              border: 'none',
              padding: '10px 20px',
              fontWeight: 600,
            }}
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
