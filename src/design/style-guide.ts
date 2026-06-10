import { z } from 'zod';

export const TypographyTokenSchema = z.object({
  size: z.string(),
  weight: z.string(),
  lineHeight: z.string(),
  tracking: z.string(),
  transform: z.string().optional(),
});

export const StyleGuideSchema = z.object({
  meta: z.object({
    id: z.string(),
    name: z.string(),
    source: z.enum(['awesome-design-md', 'firecrawl-url', 'manual']),
    sourceRef: z.string(),
    aesthetic: z.string(),
    designPhilosophy: z.string(),
    createdAt: z.string(),
  }),
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    surface: z.string(),
    surfaceStrong: z.string(),
    text: z.string(),
    textMuted: z.string(),
    textInverse: z.string(),
    border: z.string(),
    success: z.string(),
    warning: z.string(),
    error: z.string(),
    custom: z.record(z.string()).default({}),
  }),
  typography: z.object({
    headingFont: z.string(),
    bodyFont: z.string(),
    monoFont: z.string(),
    scale: z.object({
      displayLg: TypographyTokenSchema,
      displayMd: TypographyTokenSchema,
      h1: TypographyTokenSchema,
      h2: TypographyTokenSchema,
      h3: TypographyTokenSchema,
      h4: TypographyTokenSchema,
      bodyLg: TypographyTokenSchema,
      body: TypographyTokenSchema,
      bodySm: TypographyTokenSchema,
      caption: TypographyTokenSchema,
      label: TypographyTokenSchema,
    }),
  }),
  spacing: z.object({
    xs: z.string(),
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    xl: z.string(),
    section: z.string(),
    container: z.string(),
    gutter: z.string(),
  }),
  radii: z.object({
    none: z.string(),
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    xl: z.string(),
    pill: z.string(),
    full: z.string(),
  }),
  shadows: z.object({
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    glow: z.string(),
  }),
  components: z.object({
    button: z.object({
      primaryBg: z.string(),
      primaryText: z.string(),
      primaryRadius: z.string(),
      primaryPadding: z.string(),
      secondaryStyle: z.enum(['outline', 'ghost', 'soft']),
      ctaStyle: z.string(),
    }),
    card: z.object({
      background: z.string(),
      border: z.string(),
      radius: z.string(),
      shadow: z.string(),
      padding: z.string(),
    }),
    nav: z.object({
      style: z.enum(['floating', 'sticky', 'static', 'full-width']),
      background: z.string(),
      textColor: z.string(),
      ctaStyle: z.string(),
    }),
    hero: z.object({
      layout: z.enum(['centered', 'split-left', 'split-right', 'full-bleed']),
      headlineTreatment: z.string(),
      ctaCount: z.number(),
    }),
    footer: z.object({
      background: z.string(),
      style: z.enum(['minimal', 'full', 'dark-band']),
    }),
  }),
  motion: z.object({
    style: z.enum(['none', 'subtle', 'expressive']),
    defaultDuration: z.string(),
    defaultEasing: z.string(),
    pageLoad: z.string(),
  }),
  aiSystemPromptAddition: z.string(),
  tailwindExtension: z.record(z.unknown()).default({}),
  cssVariables: z.string(),
});

export type StyleGuide = z.infer<typeof StyleGuideSchema>;

const defaultToken = (size: string, weight = '400'): z.infer<typeof TypographyTokenSchema> => ({
  size,
  weight,
  lineHeight: '1.5',
  tracking: '0',
});

export function generateCssVariables(guide: StyleGuide): string {
  const c = guide.colors;
  return `:root {
  --fp-primary: ${c.primary};
  --fp-secondary: ${c.secondary};
  --fp-accent: ${c.accent};
  --fp-bg: ${c.background};
  --fp-surface: ${c.surface};
  --fp-text: ${c.text};
  --fp-text-muted: ${c.textMuted};
  --fp-border: ${c.border};
  --fp-font-heading: ${guide.typography.headingFont}, system-ui, sans-serif;
  --fp-font-body: ${guide.typography.bodyFont}, system-ui, sans-serif;
  --fp-radius-md: ${guide.radii.md};
  --fp-shadow-md: ${guide.shadows.md};
}`;
}

export function buildDefaultStyleGuide(themeId: string, themeName: string, aesthetic: string): StyleGuide {
  const id = `sg_${themeId}`;
  const guide: StyleGuide = {
    meta: {
      id,
      name: themeName,
      source: 'awesome-design-md',
      sourceRef: themeId,
      aesthetic,
      designPhilosophy: `${themeName} inspired design system with clean typography and balanced spacing.`,
      createdAt: new Date().toISOString(),
    },
    colors: {
      primary: '#000000',
      secondary: '#666666',
      accent: '#6c8cff',
      background: '#ffffff',
      surface: '#f5f5f5',
      surfaceStrong: '#ebebeb',
      text: '#111111',
      textMuted: '#666666',
      textInverse: '#ffffff',
      border: '#e5e5e5',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      custom: {},
    },
    typography: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      monoFont: 'ui-monospace, monospace',
      scale: {
        displayLg: defaultToken('3.5rem', '700'),
        displayMd: defaultToken('2.5rem', '700'),
        h1: defaultToken('2rem', '700'),
        h2: defaultToken('1.5rem', '600'),
        h3: defaultToken('1.25rem', '600'),
        h4: defaultToken('1.125rem', '600'),
        bodyLg: defaultToken('1.125rem'),
        body: defaultToken('1rem'),
        bodySm: defaultToken('0.875rem'),
        caption: defaultToken('0.75rem'),
        label: defaultToken('0.75rem', '600'),
      },
    },
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      section: '80px',
      container: '1200px',
      gutter: '24px',
    },
    radii: {
      none: '0',
      sm: '4px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      pill: '999px',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px rgba(0,0,0,0.05)',
      md: '0 4px 12px rgba(0,0,0,0.08)',
      lg: '0 12px 32px rgba(0,0,0,0.12)',
      glow: '0 0 24px rgba(108,140,255,0.35)',
    },
    components: {
      button: {
        primaryBg: '#000000',
        primaryText: '#ffffff',
        primaryRadius: '999px',
        primaryPadding: '12px 24px',
        secondaryStyle: 'outline',
        ctaStyle: 'Black pill button, full-width on mobile',
      },
      card: {
        background: '#ffffff',
        border: '1px solid #e5e5e5',
        radius: '12px',
        shadow: '0 4px 12px rgba(0,0,0,0.08)',
        padding: '24px',
      },
      nav: {
        style: 'sticky',
        background: '#ffffff',
        textColor: '#111111',
        ctaStyle: 'Primary CTA in nav, right-aligned',
      },
      hero: {
        layout: 'centered',
        headlineTreatment: 'Large display heading, tight tracking',
        ctaCount: 2,
      },
      footer: {
        background: '#111111',
        style: 'dark-band',
      },
    },
    motion: {
      style: 'subtle',
      defaultDuration: '200ms',
      defaultEasing: 'ease-out',
      pageLoad: 'staggered fade-up',
    },
    aiSystemPromptAddition: `Adopt the ${themeName} aesthetic: ${aesthetic}. Use Inter or system fonts unless specified. Prefer clean spacing and minimal decoration.`,
    tailwindExtension: {},
    cssVariables: '',
  };
  guide.cssVariables = generateCssVariables(guide);
  return StyleGuideSchema.parse(guide);
}
