# Design Superpower System — Architecture & Spec
> React CMS Platform · First-Class Web Design Module · v1.0

---

## Overview

This module gives admin users a design system capability that most professional agencies charge thousands of dollars to produce. It sits at the very beginning of site creation — before a single page is built — and its output (a normalized Style Guide) flows into every subsequent system: page templates, blog posts, campaign emails, AI prompts, and design skills.

**Three parallel paths, one destination:**

```
Path A: awesome-design-md           →
Path B: Custom URL + Firecrawl      →  Normalized Style Guide  →  Theme Preview  →  Site
Path C: [Theme Factory Orchestrator runs across all paths]
```

The Style Guide is the site's design DNA. Once set, it's injected as context into every AI call, every component generation, and every design skill activation — so the site stays coherent no matter how many different people or tools touch it.

---

## 1. Normalized Style Guide Schema

This is the shared output format regardless of which path produced it. Everything downstream reads from this shape.

```typescript
// types/style-guide.ts

interface StyleGuide {
  meta: {
    id: string;
    name: string;                    // "Vercel-Inspired" or "Custom: stripe.com"
    source: 'awesome-design-md' | 'firecrawl-url' | 'manual';
    sourceRef: string;               // folder name, URL, or "manual"
    aesthetic: string;               // "Minimalist Precision" / "Brutalist Editorial" / etc.
    designPhilosophy: string;        // 2-3 sentence description of the design direction
    createdAt: string;
  };
  
  colors: {
    primary: string;                 // hex
    secondary: string;
    accent: string;
    background: string;
    surface: string;                 // cards, panels
    surfaceStrong: string;           // elevated surfaces
    text: string;                    // body copy
    textMuted: string;               // secondary text
    textInverse: string;             // text on dark backgrounds
    border: string;
    success: string;
    warning: string;
    error: string;
    custom: Record<string, string>;  // any extra brand colors
  };
  
  typography: {
    headingFont: string;             // "Geist" / "Inter" / "Playfair Display"
    bodyFont: string;
    monoFont: string;                // optional, for code/technical elements
    scale: {
      displayLg: TypographyToken;
      displayMd: TypographyToken;
      h1: TypographyToken;
      h2: TypographyToken;
      h3: TypographyToken;
      h4: TypographyToken;
      bodyLg: TypographyToken;
      body: TypographyToken;
      bodySm: TypographyToken;
      caption: TypographyToken;
      label: TypographyToken;
    };
  };
  
  spacing: {
    xs: string;   // 4px
    sm: string;   // 8px
    md: string;   // 16px
    lg: string;   // 24px
    xl: string;   // 32px
    section: string;  // 80–96px (major section gap)
    container: string; // max-width of content
    gutter: string;   // horizontal page padding
  };
  
  radii: {
    none: string;    // 0
    sm: string;      // 4px
    md: string;      // 8px
    lg: string;      // 12px
    xl: string;      // 16px
    pill: string;    // 999px
    full: string;    // 9999px (circles)
  };
  
  shadows: {
    sm: string;    // subtle lift
    md: string;    // card elevation
    lg: string;    // modal / dropdown
    glow: string;  // optional brand-colored glow
  };
  
  components: {
    button: {
      primaryBg: string;
      primaryText: string;
      primaryRadius: string;
      primaryPadding: string;
      secondaryStyle: 'outline' | 'ghost' | 'soft';
      ctaStyle: string;    // prose description for AI ("black pill, full-width")
    };
    card: {
      background: string;
      border: string;
      radius: string;
      shadow: string;
      padding: string;
    };
    nav: {
      style: 'floating' | 'sticky' | 'static' | 'full-width';
      background: string;
      textColor: string;
      ctaStyle: string;
    };
    hero: {
      layout: 'centered' | 'split-left' | 'split-right' | 'full-bleed';
      headlineTreatment: string;   // "display-lg with gradient clip"
      ctaCount: number;            // 1 or 2
    };
    footer: {
      background: string;
      style: 'minimal' | 'full' | 'dark-band';
    };
  };
  
  motion: {
    style: 'none' | 'subtle' | 'expressive';
    defaultDuration: string;       // "200ms" / "350ms"
    defaultEasing: string;         // "ease-out" / "cubic-bezier(0.4, 0, 0.2, 1)"
    pageLoad: string;              // "staggered fade-up" / "none"
  };
  
  // Injected verbatim into all AI design prompts for this site
  aiSystemPromptAddition: string;  // "Adopt a minimalist SaaS aesthetic. Black and white with Geist font..."
  
  // Generated Tailwind config extension (ready to paste into tailwind.config.ts)
  tailwindExtension: Record<string, unknown>;
  
  // Generated CSS custom properties (ready to paste into globals.css)
  cssVariables: string;
}

interface TypographyToken {
  size: string;       // "3rem"
  weight: string;     // "700"
  lineHeight: string; // "1.1"
  tracking: string;   // "-0.02em"
  transform?: string; // "uppercase" (optional)
}
```

---

## 2. Theme Acquisition Module

### Source A — awesome-design-md Integration

**What the repo contains:** 60+ DESIGN.md files capturing design systems from popular products including Vercel, Figma, Framer, Webflow, Resend, Zapier, Airtable, ElevenLabs, Cursor, Mistral, Coinbase, and many others. Each file defines colors (with hex values), typography tokens, spacing scales, component specs, and usage guidelines — exactly what feeds our Style Guide schema.

**Integration approach: GitHub API + bundled manifest (not npm)**
The repo isn't published to npm and changes over time. Best approach:
- Bundle a static `design-themes-manifest.json` in the CMS at build time (theme names + descriptions, updated when CMS ships new versions)
- Fetch actual DESIGN.md content on-demand via GitHub raw content URL
- Cache fetched content in the admin DB so it's available offline

```typescript
// lib/design/awesomeDesignMd.ts

const MANIFEST_BASE = 'https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md';

// Bundled manifest (ships with CMS, updated each release)
// lib/design/themes-manifest.json
export const THEMES_MANIFEST = [
  { id: 'vercel',      name: 'Vercel',      desc: 'Black & white precision, Geist font' },
  { id: 'figma',       name: 'Figma',       desc: 'Vibrant multi-color, playful yet professional' },
  { id: 'framer',      name: 'Framer',      desc: 'Bold black & blue, motion-first' },
  { id: 'webflow',     name: 'Webflow',     desc: 'Blue-accented, polished marketing site' },
  { id: 'resend',      name: 'Resend',      desc: 'Minimal dark theme, monospace accents' },
  { id: 'zapier',      name: 'Zapier',      desc: 'Warm orange, illustration-driven' },
  { id: 'airtable',    name: 'Airtable',    desc: 'Colorful, friendly, structured data' },
  { id: 'clay',        name: 'Clay',        desc: 'Organic shapes, soft gradients' },
  { id: 'cursor',      name: 'Cursor',      desc: 'Sleek dark, gradient accents' },
  { id: 'elevenlabs',  name: 'ElevenLabs',  desc: 'Dark cinematic, audio-waveform aesthetics' },
  { id: 'cal',         name: 'Cal.com',     desc: 'Clean SaaS, strong typographic hierarchy' },
  { id: 'mistral',     name: 'Mistral AI',  desc: 'French minimalism, purple-toned' },
  { id: 'superhuman',  name: 'Superhuman',  desc: 'Premium dark UI, purple glow, keyboard-first' },
  { id: 'raycast',     name: 'Raycast',     desc: 'Sleek dark chrome, vibrant gradient accents' },
  // ... full list bundled in manifest JSON
];

export async function fetchDesignMd(themeId: string): Promise<string> {
  const url = `${MANIFEST_BASE}/${themeId}/DESIGN.md`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch DESIGN.md for ${themeId}`);
  return response.text();
}
```

**Parsing DESIGN.md → Style Guide**

The DESIGN.md files use a consistent token pattern: `{colors.primary}`, `{typography.display-lg}`, `{spacing.section}`, hex values in parentheses. A parser extracts these into our schema:

```typescript
// lib/design/parsers/parseDesignMd.ts

export async function parseDesignMdToStyleGuide(
  rawMd: string,
  themeId: string,
  themeName: string
): Promise<StyleGuide> {
  // 1. Extract hex colors using regex patterns
  // 2. Extract font names
  // 3. Extract spacing/radius values
  // 4. Pass raw MD to BYOK AI with schema prompt to fill in gaps and normalize
  // AI call produces the complete StyleGuide JSON
  
  const systemPrompt = `You are a design system parser. Given this DESIGN.md file, 
  extract all design tokens and return a complete StyleGuide JSON matching this schema:
  ${JSON.stringify(STYLE_GUIDE_SCHEMA)}
  Fill ALL fields. For missing values, infer from the design direction described.
  Return ONLY valid JSON, no markdown, no explanation.`;
  
  return callBYOKApi(systemPrompt, rawMd);
}
```

### Source B — Custom URL Brand DNA Extraction (Firecrawl)

User enters any URL (competitor site, brand inspiration, client's existing site). Firecrawl fetches the full page content, CSS, and design patterns. AI extracts the design DNA.

**Requirements:** Admin must have Firecrawl API key in settings (BYOK).

```typescript
// lib/design/firecrawlExtract.ts

export async function extractBrandDna(
  url: string,
  firecrawlApiKey: string
): Promise<StyleGuide> {
  
  // Step 1: Firecrawl scrape with CSS extraction
  const crawlResult = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['html', 'screenshot'],
      actions: [],
      includeTags: ['style', 'link'],
    }),
  });
  
  const { html, screenshot } = await crawlResult.json();
  
  // Step 2: Extract inline styles, CSS variables, font links
  const cssContext = extractCssContext(html); // pulls <style> blocks, CSS vars, font imports
  
  // Step 3: AI extraction call
  const systemPrompt = `You are a brand design analyst. Analyze this website's HTML, 
  extracted CSS, and design elements. Identify:
  - Primary, secondary, and accent colors (exact hex values)
  - Typography choices (font families, sizes, weights)
  - Design aesthetic (Minimalist / Corporate / Playful / Editorial / etc.)
  - Spacing patterns and layout density
  - Component styles (buttons, cards, nav, hero)
  - Motion preferences
  
  Return a complete StyleGuide JSON matching this schema: ${JSON.stringify(STYLE_GUIDE_SCHEMA)}
  Be specific with hex values. Infer any gaps from the overall aesthetic.
  Return ONLY valid JSON.`;
  
  const styleGuide = await callBYOKApi(systemPrompt, cssContext);
  styleGuide.meta.source = 'firecrawl-url';
  styleGuide.meta.sourceRef = url;
  
  return styleGuide;
}
```

### Theme Preview Component

Both paths produce the same Style Guide JSON. Both pass it to the same Theme Preview component. This is the most important UI in the entire design system — it has to look stunning to build confidence before the admin commits.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  THEME PREVIEW: Vercel-Inspired                       [← Back] [Use →]  │
│  "Black and white precision. Geist font. Developer-grade visual clarity." │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ██ COLORS                  ██ TYPOGRAPHY                                │
│  ●●●●●●●●●●●               Display: Geist 56px / 700 / -0.02em          │
│  Primary  Surface  Text     Heading: Geist 36px / 600 / -0.01em         │
│                             Body: Geist 16px / 400 / 0em                 │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                           │
│  █ HERO PREVIEW                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  NAV: [Logo]              [Products] [Docs] [Pricing]    [Get Start]│ │
│  │ ─────────────────────────────────────────────────────────────────  │ │
│  │                                                                     │ │
│  │         Ship faster.                                                │ │
│  │         Your headline goes here and wraps like this.               │ │
│  │                                                                     │ │
│  │         Body copy that explains the value proposition clearly      │ │
│  │         in one or two sentences. Placeholder only.                 │ │
│  │                                                                     │ │
│  │    [Get Started]   [Read the Docs →]                               │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  █ COMPONENTS                                                             │
│  [Primary CTA]  [Secondary]  [Ghost]    ✓ Badge     ⚠ Status            │
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  Card Title  │  │  Card Title  │  │  Card Title  │                   │
│  │  Body copy   │  │  Body copy   │  │  Body copy   │                   │
│  │  [Action]    │  │  [Action]    │  │  [Action]    │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                           │
│  ─────────────────────────────────────────────────────────────────────  │
│  Input: [          Placeholder         ]     [Submit]                    │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                           │
│  █ FOOTER PREVIEW                                [Dark band footer style] │
│  ___________________________________________________________________     │
└─────────────────────────────────────────────────────────────────────────┘
```

The preview renders using Tailwind inline styles driven entirely by the StyleGuide JSON — no hardcoded values. The same component is used for both Path A and Path B previews, making them directly comparable if the admin wants to toggle between a chosen awesome-design theme and their Firecrawl extraction.

**"Use This Theme" button:**
1. Saves Style Guide to `style_guides` DB table for this site
2. Generates and writes `tailwind.config.ts` extension (merging with existing)
3. Generates and writes `globals.css` CSS variables block
4. Sets flag `site.style_guide_id`
5. Toast: "Design DNA saved. All AI builds will now follow this style."

---

## 3. Theme Factory — The Orchestrator (Always-On)

**Your instinct about Theme Factory as orchestrator is correct.** Here's the rationale:

Theme Factory is a Claude Skill that defines and applies consistent visual themes. It can style artifacts with 10 pre-set professional themes or generate custom themes on-the-fly. It acts as a *normalizer* — whatever raw design data comes from awesome-design-md or Firecrawl, Theme Factory ensures the output is coherent, complete, and aesthetically consistent.

### How It Functions as Orchestrator

```
awesome-design-md DESIGN.md raw text  ─┐
                                        ├→ Theme Factory Skill (active) → Complete Style Guide
Firecrawl HTML/CSS extraction          ─┘
```

Theme Factory should be **installed by default** as a project-level skill during initial setup. It runs implicitly whenever the admin is doing design-related work. It doesn't need to be invoked — its presence in `.claude/skills/` means Claude will reference it on any design call.

**What Theme Factory adds over raw parsing:**
- Fills gaps the parser couldn't extract (motion preferences, secondary component states)
- Ensures the color palette has sufficient contrast ratios (WCAG)
- Generates the `aiSystemPromptAddition` field — the key text that gets prepended to every future AI build prompt for this site
- Prevents scope creep when multiple people edit the site over time

### Installation

```bash
# Auto-installed at project creation
cp skills/theme-factory/SKILL.md .claude/skills/theme-factory.md

# Written to .claude/CLAUDE.md
# This site uses the Theme Factory skill for all design decisions.
# Always reference .claude/style-guide.md before generating any UI component.
```

Additionally, on Style Guide save, the system writes a `.claude/style-guide.md` file — a human-readable version of the Style Guide JSON that Claude Code and Cursor agents can read directly during any coding session:

```markdown
# Site Style Guide — [Site Name]
> Source: Vercel-Inspired (awesome-design-md)
> Aesthetic: Minimalist precision. Black and white. Developer-grade clarity.

## Colors
- Primary: #000000
- Background: #FFFFFF
- Accent: #0070F3 (blue links only)
...

## Typography
- Heading Font: Geist
- Body Font: Geist
...

## AI Instruction
When building any UI component for this site, adopt a minimalist SaaS aesthetic...
```

---

## 4. Design Skills Manager

### The Five Skills — What They Actually Do

Based on the official Anthropic skills repo at `github.com/anthropics/skills`:

| Skill | What It Does | Best For |
|---|---|---|
| **frontend-design** | Instructs Claude to avoid generic aesthetics and make bold, deliberate design decisions. Before writing code, it selects an aesthetic (Brutalism, Minimalism, Retro-futurism, etc.) then develops accordingly. Covers unexpected layouts, asymmetry, overlap, diagonal flow, gradient meshes, noise textures, and motion micro-interactions. | Every page, every component |
| **algorithmic-art** | Creates generative art via p5.js with seeded randomness, flow fields, and particle systems. Interactive HTML output with sliders and seeds. | Hero backgrounds, decorative elements, NFT projects |
| **canvas-design** | Designs visual art in PNG and PDF formats using principled design philosophy. Defines a named design movement before executing. | Service page hero images, infographics, illustrations, OG images |
| **theme-factory** | Styles artifacts with 10 pre-set professional themes or generates custom themes on-the-fly. | Design system orchestrator — install at project level always |
| **web-artifacts-builder** | Builds complex HTML artifacts using React 18 + TypeScript + Tailwind + shadcn/ui components, bundled into a single HTML file. | Interactive widgets, calculators, charts, embedded tools within pages |

### Skills Install UI

Each skill is presented as a card in the CMS admin under **Settings → Design Skills**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ DESIGN SKILLS                                                             │
│ Install Claude AI skills to supercharge the quality of your AI builds.   │
│                                                                           │
│ ┌─────────────────────────────────┐  ┌──────────────────────────────────┐│
│ │ 🎨 Frontend Design              │  │ 🌀 Algorithmic Art               ││
│ │ ● Installed (project-level)     │  │ ○ Not installed                  ││
│ │                                 │  │                                  ││
│ │ Eliminates generic "AI slop"    │  │ Generative art via p5.js.        ││
│ │ aesthetics. Forces deliberate   │  │ Interactive HTML with sliders,   ││
│ │ design choices before any code  │  │ seeds, and parameter controls.   ││
│ │ is written.                     │  │ Ideal for hero backgrounds and   ││
│ │                                 │  │ decorative page elements.        ││
│ │ Recommended: All projects       │  │ Recommended: Creative sites      ││
│ │                                 │  │                                  ││
│ │ [Reinstall ▾]                   │  │ [Install ▾]                      ││
│ └─────────────────────────────────┘  └──────────────────────────────────┘│
│                                                                           │
│ ┌─────────────────────────────────┐  ┌──────────────────────────────────┐│
│ │ 🖼 Canvas Design                │  │ ✨ Theme Factory          DEFAULT││
│ │ ○ Not installed                 │  │ ● Installed (auto — project)    ││
│ │                                 │  │                                  ││
│ │ Creates posters, infographics,  │  │ Orchestrates design consistency  ││
│ │ illustrations, and OG images.   │  │ across all AI builds. Installed  ││
│ │ Defines a "design philosophy"   │  │ automatically on site creation   ││
│ │ before executing each piece.    │  │ and runs as background context.  ││
│ │                                 │  │                                  ││
│ │ Recommended: Service/About pgs  │  │ Recommended: All projects        ││
│ │                                 │  │                                  ││
│ │ [Install ▾]                     │  │ [Reinstall]                      ││
│ └─────────────────────────────────┘  └──────────────────────────────────┘│
│                                                                           │
│ ┌─────────────────────────────────┐                                       │
│ │ ⚡ Web Artifacts Builder        │                                       │
│ │ ○ Not installed                 │                                       │
│ │                                 │                                       │
│ │ Scaffolds React 18 + TypeScript │                                       │
│ │ + Tailwind + 40+ shadcn/ui      │                                       │
│ │ components into interactive     │                                       │
│ │ widgets and embedded tools.     │                                       │
│ │                                 │                                       │
│ │ Recommended: Calculators, forms │                                       │
│ │ dynamic charts, quizzes         │                                       │
│ │ [Install ▾]                     │                                       │
│ └─────────────────────────────────┘                                       │
└──────────────────────────────────────────────────────────────────────────┘
```

### Install Path Selection Popup

Clicking **[Install ▾]** opens a dropdown → **"Choose install scope"** → shows popup:

```
┌─────────────────────────────────────────────────────────┐
│ Install: Canvas Design Skill                            │
│ ─────────────────────────────────────────────────────── │
│ Where should this skill live?                           │
│                                                         │
│ ● Global (recommended for design skills)               │
│   ~/.claude/skills/canvas-design.md                    │
│   Available in ALL projects on this machine            │
│                                                         │
│ ○ Project root                                         │
│   ./.claude/skills/canvas-design.md                    │
│   Available for all files in this project              │
│                                                         │
│ ○ Frontend only                                        │
│   ./src/.claude/skills/canvas-design.md               │
│   Active when Claude works in /src directory           │
│                                                         │
│ ○ Custom path                                          │
│   [__________________________]                         │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ What gets copied:                                       │
│ SKILL.md from github.com/anthropics/skills              │
│ → to your chosen path                                   │
│                                                         │
│ [Cancel]                    [Copy Skill File →]         │
└─────────────────────────────────────────────────────────┘
```

**On "Copy Skill File":**
1. Fetch SKILL.md from `raw.githubusercontent.com/anthropics/skills/main/skills/{skill-name}/SKILL.md`
2. Create directory if needed
3. Write file to chosen path
4. Show success toast with the full path
5. Update Skills card to show "Installed" badge

**Path Recommendation Logic:**

```typescript
const SKILL_PATH_RECOMMENDATIONS = {
  'theme-factory':         { scope: 'project',  reason: 'Needs access to your style guide file' },
  'frontend-design':       { scope: 'project',  reason: 'Should know your chosen aesthetic' },
  'algorithmic-art':       { scope: 'global',   reason: 'Pure creative skill, project-agnostic' },
  'canvas-design':         { scope: 'global',   reason: 'Pure creative skill, project-agnostic' },
  'web-artifacts-builder': { scope: 'project',  reason: 'Needs to know your component stack' },
};
```

---

## 5. Page Builder Module

### Three-Section Structure

The Page Builder sits in its own tab/section in the site setup flow, after the Style Guide is set:

```
SITE SETUP FLOW:
  1. Brand DNA / Theme Selection  ✓
  2. Page Builder                 ← current
  3. Blog Setup (if selected)
  4. Launch
```

### Section A — Boilerplate Pages (Checkbox List)

```
┌─────────────────────────────────────────────────────────────────┐
│ STANDARD PAGES                                                   │
│ Select pages to generate. All pages use your active Style Guide. │
│                                                                  │
│ Essential                                                        │
│ ☑ Home Page          ← skeleton already exists from CMS setup   │
│ ☑ Contact Page       Contact form + address + map embed option  │
│ ☑ About Page         Team, story, mission sections              │
│ ☑ 404 Page           Custom error with navigation recovery      │
│                                                                  │
│ Legal & Technical                                                │
│ ☑ Privacy Policy     AI-drafted from your business info        │
│ ☑ Terms of Service   AI-drafted from your business info        │
│ ☐ Cookie Policy      GDPR-focused, optional                    │
│ ☐ Accessibility Statement  WCAG reference page                 │
│ ☑ robots.txt         Configured for your sitemap URL           │
│ ☑ sitemap.xml        Auto-generated from all pages             │
│                                                                  │
│ Optional                                                         │
│ ☐ FAQ Page           Q&A accordion layout                      │
│ ☐ Pricing Page       Pricing cards / comparison table          │
│ ☐ Case Studies Index List/grid of client success stories       │
│ ☐ Team Page          Individual profile cards                  │
│ ☐ Portfolio/Work     Gallery or grid of past projects          │
│                                                                  │
│ Blog                                                             │
│ ☑ Blog Index         [Kinetic Masonry ▾]  (uses blog spec)     │
│ ☑ Blog Post Template (uses blog spec — already specced)        │
└─────────────────────────────────────────────────────────────────┘
```

### Section B — Service Pages

```
┌─────────────────────────────────────────────────────────────────┐
│ SERVICE PAGES                                              [+ Add]│
│                                                                  │
│ ☑ Service Index Page  ← lists all services, links into each    │
│   Also add services to: ☑ Home Page Section  ☐ Standalone only │
│                                                                  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                  │
│ Service 1                                               [✕ Remove]│
│ Page Name:      [Web Design Services                         ]   │
│ Primary KW:     [web design services                         ]   │
│ Alt Keywords:   [website design, custom web design, web devel]   │
│ Template:       [Service Detail ▾]                               │
│                                                                  │
│ Service 2                                               [✕ Remove]│
│ Page Name:      [SEO Services                                ]   │
│ Primary KW:     [SEO services                                ]   │
│ Alt Keywords:   [search engine optimization, local SEO, SEO a]   │
│ Template:       [Service Detail ▾]                               │
│                                                                  │
│ [+ Add Service]                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Template dropdown options:
- **Service Detail** (default) — headline, problem statement, solution, features, testimonials, CTA
- **Service Landing** — conversion-focused, above-fold CTA, social proof heavy
- **Service + Process** — adds a numbered process/steps section
- **Service + FAQ** — adds collapsible FAQ below features

### Page Generation Flow

When admin clicks "Generate Selected Pages":

```
For each selected page:
  1. Fetch page template from /src/templates/{template-name}/
  2. Inject StyleGuide tokens into template (replace CSS variable placeholders)
  3. Pass to BYOK AI with:
     - Style Guide aiSystemPromptAddition
     - Page type context
     - Keywords (for service pages)
     - Business info (from settings)
  4. AI fills placeholder content with real copy
  5. Page saved to CMS with status "Draft — review needed"
  6. Admin can then open in editor, edit with AI chat, publish

Progress UI:
  ✓ Contact Page — generated
  ✓ Privacy Policy — generated  
  ⟳ Service: Web Design — generating...
  ○ Service: SEO Services — queued
  ○ Blog Index — queued
```

Pages are **never auto-published** — always Draft first. Admin reviews and publishes individually.

### Template Storage Architecture

```
src/
└── templates/
    ├── _base/                    ← shared layout, nav, footer (already theme-aware)
    ├── home/
    │   └── template.tsx
    ├── contact/
    │   └── template.tsx
    ├── about/
    │   └── template.tsx
    ├── privacy-policy/
    │   └── template.tsx
    ├── terms/
    │   └── template.tsx
    ├── service-detail/
    │   └── template.tsx
    ├── service-landing/
    │   └── template.tsx
    ├── service-with-process/
    │   └── template.tsx
    ├── service-with-faq/
    │   └── template.tsx
    ├── blog-index/
    │   └── template.tsx         ← references blog module designs
    ├── blog-post/
    │   └── template.tsx
    ├── faq/
    │   └── template.tsx
    ├── pricing/
    │   └── template.tsx
    ├── 404/
    │   └── template.tsx
    └── _legal/
        └── template.tsx         ← shared for Privacy + Terms
```

Templates are **not** finished pages — they're component scaffolds with:
- `{{HEADLINE}}` placeholders for AI to fill
- `{{BODY_COPY}}` blocks
- `{{SERVICE_NAME}}` / `{{PRIMARY_KEYWORD}}` tokens
- CSS variable references (not hardcoded colors) so they inherit the Style Guide automatically

---

## 6. UX Flow — Full Admin Journey

```
New Site Created
       ↓
1. DESIGN DNA TAB
   ┌─────────────────────────────────────────┐
   │  How do you want to define your design? │
   │                                         │
   │  [Browse 60+ Proven Themes]             │  ← opens awesome-design dropdown
   │  [Extract from a URL]                   │  ← opens Firecrawl URL input
   │  [Start Blank]                          │  ← manual Style Guide form
   └─────────────────────────────────────────┘
       ↓ (either path → same output)
2. THEME PREVIEW
   [preview renders]
   [Use This Theme] or [Try Another]
       ↓
3. Theme Factory + Style Guide saved
   tailwind.config.ts updated
   globals.css updated
   .claude/style-guide.md written
       ↓
4. PAGE BUILDER TAB
   [checkbox list + service page forms]
   [Generate Selected Pages]
       ↓ (pages generated as drafts)
5. DESIGN SKILLS TAB
   [install skill cards]
   [recommended paths shown]
       ↓
6. BLOG SETUP (if checked in page builder)
   [existing blog spec flow]
       ↓
7. SITE IS READY FOR EDITING
   AI Chat knows the Style Guide
   Every AI build prompt has the aesthetic injected
   Frontend Design Skill prevents generic output
   Theme Factory ensures consistency across sessions
```

---

## 7. Database Schema

```sql
-- One Style Guide per site
CREATE TABLE style_guides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id),
  name            TEXT NOT NULL,
  source          TEXT NOT NULL,   -- 'awesome-design-md' | 'firecrawl-url' | 'manual'
  source_ref      TEXT,            -- theme ID or URL
  raw_input       TEXT,            -- original DESIGN.md or Firecrawl output (for re-parsing)
  schema_json     JSONB NOT NULL,  -- full StyleGuide object
  tailwind_ext    JSONB,           -- tailwind config extension
  css_variables   TEXT,            -- CSS custom properties block
  ai_prompt_addon TEXT,            -- aiSystemPromptAddition field
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Page generation jobs
CREATE TABLE page_generation_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES sites(id),
  style_guide_id  UUID REFERENCES style_guides(id),
  page_type       TEXT NOT NULL,   -- 'contact' | 'service' | 'privacy' | etc.
  page_name       TEXT,
  template        TEXT,            -- template folder name
  keywords        JSONB,           -- {primary, alternates}
  status          TEXT DEFAULT 'queued', -- queued|generating|complete|error
  result_page_id  UUID,            -- references the generated page record
  error_message   TEXT,
  queued_at       TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- Installed skills per site
CREATE TABLE installed_skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES sites(id),
  skill_name  TEXT NOT NULL,       -- 'frontend-design' | 'theme-factory' etc.
  install_path TEXT NOT NULL,      -- actual filesystem path where SKILL.md was written
  scope       TEXT NOT NULL,       -- 'global' | 'project' | 'frontend' | 'custom'
  source_url  TEXT,                -- GitHub raw URL it was fetched from
  installed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id, skill_name, scope)
);
```

---

## 8. Build Checklist

### Phase 1: Style Guide Infrastructure
- [ ] `StyleGuide` TypeScript interface + Zod schema
- [ ] `style_guides` DB table + API routes
- [ ] `parsers/parseDesignMd.ts` — DESIGN.md → StyleGuide
- [ ] `parsers/parseFirecrawl.ts` — HTML/CSS → StyleGuide
- [ ] Tailwind config extension generator
- [ ] CSS variables generator
- [ ] `.claude/style-guide.md` file writer

### Phase 2: awesome-design-md Integration
- [ ] Bundle `themes-manifest.json` (60+ entries)
- [ ] GitHub raw content fetch (on-demand, cached)
- [ ] Searchable dropdown with name + description
- [ ] "Featured" section (top 8–10 most versatile for agency work)

### Phase 3: Firecrawl Integration
- [ ] Firecrawl API key input + validation in settings
- [ ] URL input + crawl trigger
- [ ] CSS context extractor from HTML
- [ ] BYOK AI parse call with StyleGuide schema prompt

### Phase 4: Theme Preview Component
- [ ] `ThemePreview.tsx` — full demo page driven by StyleGuide JSON
- [ ] Live-updating as Style Guide JSON changes
- [ ] "Use This Theme" → save + write config files

### Phase 5: Theme Factory Integration
- [ ] Auto-install at site creation
- [ ] SKILL.md write to `.claude/skills/`
- [ ] `.claude/CLAUDE.md` reference line appended

### Phase 6: Page Builder
- [ ] Boilerplate page checkbox UI
- [ ] Service page definition form (repeatable rows)
- [ ] Template files (all page types)
- [ ] Page generation queue + job runner
- [ ] Progress UI
- [ ] Draft page creation on completion

### Phase 7: Design Skills Manager
- [ ] Skills catalog cards UI
- [ ] Install path selection popup
- [ ] SKILL.md fetch from GitHub + write to filesystem
- [ ] Installed status tracking (`installed_skills` table)
- [ ] Reinstall / remove options

---

## Key Decisions Summary

| Question | Decision | Rationale |
|---|---|---|
| awesome-design-md as npm? | No — GitHub API + bundled manifest | Repo isn't published to npm; GitHub raw is reliable and stays current |
| Theme Factory placement | Auto-installed at project creation, always-on | It's the consistency layer that makes everything else coherent |
| When does Style Guide get set? | Before any page generation | Everything downstream depends on it |
| Legal pages (Privacy, Terms)? | AI-generated from business info | Admin needs to review, but 90% of the work done |
| Service page templates | 4 variants, all start from same base | Different emphasis (conversion vs process vs FAQ) without duplicating work |
| Skills scope recommendation | frontend-design + theme-factory at project level; art skills global | Design skills need access to the style guide file; art skills are universal |
