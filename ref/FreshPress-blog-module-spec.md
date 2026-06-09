# Blog Module — Master Feature Specification
> React CMS Platform · Agency License Model · v1.0 Draft

---

## Overview

This module replaces WordPress blogging with a system that feels less like a tool and more like having a senior SEO editor, a design team, and an AI writing room baked directly into the interface. The guiding principle: **effortless for the admin, invisible to the end user, extraordinary in output.**

---

## 1. Keyword Silo Architecture

### Concept
Each blog section is organized around a **keyword tree**, not a flat tag list. This mirrors how Google actually evaluates topical authority.

```
Main Keyword (e.g., "email marketing")
└── Pillar Post         ← one per main keyword, comprehensive / long-form
    ├── Supportive Post  ← cluster article, links back to Pillar
    ├── Supportive Post
    └── Supportive Post
```

### Silo Manager UI (Grid View)
- Top-level row = **Pillar Post card** (larger, distinct visual weight)
- Below each Pillar = horizontal row of **Supportive Post mini-cards**
- Cards show: Title, status badge (Draft / Published / Scheduled), word count, internal link count, AI-detection score (if run)
- Drag-to-reorder within a Pillar group
- Click "+" on a Pillar to add a Supportive Post — pre-fills keyword context automatically
- Visual link-map toggle: draws connecting lines between Pillar ↔ Supportive posts (elegant SVG overlay, not Miro-style clutter)
- Keyword entered at Pillar level flows down as context to all Supportive posts in the group

### Auto-generated on Pillar creation
- Suggested slug (SEO-clean)
- Meta title draft (under 60 chars)
- Meta description draft (under 160 chars)
- Suggested internal link anchor texts for Supportive Posts
- Schema.org Article markup stub (JSON-LD, injected at publish)

---

## 2. Idea Engine — RSS Feed Aggregator

### Feed Management (Left Sidebar Panel)
- Admin adds RSS feed URLs (industry blogs, news sources, competitor sites)
- Can label and group feeds by keyword/topic
- Optional: use a hosted aggregation service as fallback (Feedly API or RSS.app API — BYOK)
- Feed entries display: Headline, source, date, estimated read time
- One-click "star" to save for later

### Feed Entry → 3 Action Choices
When admin clicks any feed article, a modal opens with 3 tiered action buttons:

#### Option 1 — Summarize
- Sends article URL + scrape to AI via BYOK API
- Returns: 3–5 bullet summary
- Dropped into editor as a Draft starting point
- Zero formatting — just raw material for the writer

#### Option 2 — Summary + SEO Analysis
- All of Option 1, plus:
- Mini SEO card: primary keyword density, readability score, content gap notes, suggested LSI keywords
- Checks if headline contains a keyword from the user's active silo
- Flags thin content risks (word count, heading structure)
- Suggests: better meta title, stronger hook sentence

#### Option 3 — Summary + SEO + Title Ideas
- All of Option 2, plus:
- 5 new headline variants (curiosity gap, listicle, how-to, emotional, direct)
- Each headline labeled with its psychological trigger
- One-click to adopt any title as the working post title

### BYOK API for Feed Actions
- Admin enters their OpenRouter API key or direct provider key (OpenAI, Anthropic, Gemini, etc.)
- Model selector dropdown (pulls from OpenRouter model list dynamically)
- Estimated token cost shown before each action (optional transparency feature)
- System prompt for feed summarization is pre-written and locked — admin cannot break it accidentally
- Advanced mode: admin can override the system prompt if they want

---

## 3. AI Writing Workflow

### Post Editor AI Integration
- Right sidebar AI chat (shared with rest of CMS — same persistent chat, context-aware of current post)
- Chat is aware of: current post keyword, silo, existing headings, word count target
- Commands recognized naturally: "expand section 2," "rewrite intro more conversationally," "add a FAQ section," "suggest 3 more H2s," "write a conclusion"

### Model Access in Editor
- Admin picks their preferred model per session or sets a default in settings
- Supports: OpenRouter (unified, any model), direct BYOK (Anthropic, OpenAI, Google)
- Model selector visible in left sidebar, not buried in settings
- Token usage meter shown in sidebar (running total for the session)

---

## 4. AI Content Detection

### Recommended API: **Originality.ai**
**Why:** Purpose-built for agencies. Sentence-level highlighting, not just a bulk score. Plagiarism check bundled. Good API docs.
- Endpoint: `POST https://api.originality.ai/api/v1/scan/ai`
- Returns: score 0–100 + per-sentence AI probability array
- Pricing: ~$0.01 per 100 words (credit-based)
- API key: admin's own (BYOK) or platform key with markup

**Strong alternatives:**
- **GPTZero API** (`api.gptzero.me`) — excellent sentence-level confidence scores, widely trusted, good for displaying per-paragraph heat maps
- **Winston AI** — cleaner UI output, good developer API, popular with content agencies
- **Copyleaks** — adds plagiarism on top of AI detection, enterprise-tier pricing

### Detection UX Flow
1. Admin clicks **"Check AI Score"** button in left sidebar
2. Post content sent to detection API
3. Score returned as a visual gauge (e.g., "72% AI" shown as colored meter)
4. **"See Full Report"** button opens a new Tab in the editor area
5. Full Report Tab shows the complete article with:
   - AI-detected sentences highlighted in amber/red gradient
   - Hover tooltip: confidence % on each flagged sentence
   - Summary card: total AI%, human%, mixed%
6. Tab persists until admin closes it — they can reference it while rewriting

---

## 5. Human-Like Content Rewriting

### Option A — BYOK Integration (Recommended for MVP)
Admin uses their own AI model via OpenRouter with a specialized humanization system prompt. This avoids third-party dependency and produces excellent results with the right prompt engineering.
- Pre-built system prompt: instructs model to vary sentence length, inject first-person perspective cues, use colloquialisms naturally, break predictable AI patterns
- One-click "Humanize Draft" applies to selected text or full post
- Tracks: before/after AI score comparison

### Option B — Third-Party Humanizer API (Platform Upsell)
Offer this as a premium add-on: platform handles the API key, charges per-word markup.

**Recommended API: Undetectable.ai**
- Has a documented REST API (`https://api.undetectable.ai`)
- Submit → poll for result → returns full humanized text
- Several readability levels: "High School," "University," "Doctorate," "Journalist," "Marketing"
- Returns full article, not fragments
- Well-established, widely tested against major detectors

**Alternatives:**
- **StealthWriter API** — real API, aggressive rewriting style
- **Humanizer.pro** — API available, good quality-to-cost ratio
- **WriteHuman** — newer, good detection bypass rates

### Humanization UX Flow
1. Admin clicks **"Humanize Post"** in sidebar
2. Confirmation modal: shows word count, estimated cost (if using platform key)
3. Progress spinner while API processes (can take 15–45 seconds for long posts)
4. Returns rewritten article into a **"Humanized Draft" Tab** (does NOT overwrite original)
5. Side-by-side diff view: original left, humanized right, changed phrases highlighted
6. Admin clicks "Accept All," "Accept Selected," or "Discard"
7. After accepting, re-run AI detection to show improvement

### Human Editor Referral
Below the humanize workflow, a **tasteful card** (not a banner ad):
> *"Prefer a human touch? Our vetted editors on Fiverr and Upwork average a 24-hour turnaround."*
- Two buttons: Fiverr gig link, Upwork profile link (both open in new tab, use referral links)

---

## 6. Editor UX Architecture

### Three-Panel Layout

```
┌─────────────┬──────────────────────────────────┬──────────────┐
│ LEFT SIDEBAR│         MAIN EDITOR AREA          │ RIGHT SIDEBAR│
│ (collapsible│                                   │ (AI Chat)    │
│ 280px)      │  [Tab Bar: Post | SEO | Detection │              │
│             │   | Humanized | Images | Preview] │              │
│ • Silo nav  │                                   │ Persistent   │
│ • Model sel │  Active tab content               │ context-aware│
│ • Feeds     │                                   │ AI chat      │
│ • Det score │                                   │              │
│ • Actions   │                                   │ Knows current│
│ • Settings  │                                   │ post, keyword│
│             │                                   │ silo, state  │
└─────────────┴──────────────────────────────────┴──────────────┘
```

### Left Sidebar Panels (collapsible sections within sidebar)
- **Silo Navigator** — current keyword, Pillar/Supportive status, related posts
- **AI Model** — provider selector, model dropdown, token meter
- **Idea Feed** — RSS entries (collapsed list, click to expand article options)
- **AI Actions** — Summarize, Humanize, Detect, Generate Images
- **SEO Snapshot** — live word count, keyword density, meta preview, readability score
- **Typography Controls** — per-heading-level leading, tracking, drop-cap toggle
- **Schedule & Publish** — date picker, status, social push toggles

### Main Editor Tab Bar (context-sensitive, tabs appear when triggered)
- **Post** (always visible) — Rich text / block editor, always the default
- **SEO Lab** (triggered from sidebar) — full SEO analysis, meta editor, schema preview
- **AI Detection Report** (triggered after scan) — highlighted AI content view
- **Humanized Draft** (triggered after humanize) — diff view
- **Image Studio** (triggered when requesting images) — grid of results, select to insert
- **Preview** (always available) — rendered post with active theme

---

## 7. Blog Index Page Designs

### Design A — Kinetic Masonry Grid *(signature feature)*

**Behavior:**
- Standard masonry grid layout
- Each alternating row (or column, depending on axis setting) moves in the opposite direction continuously — slow, dreamlike conveyor belt motion
- Speed control: 0 (static) to 10 (fast) — default 2 (barely perceptible)
- **Angle tilt:** admin enters a degree value (-15° to +15°) applied to the entire grid container via CSS `transform: rotate(Xdeg)` — cards overflow their container slightly, clipped at edges, creating an editorial/magazine feel
- Cards themselves remain perfectly rectangular (no per-card tilt)
- All cards remain fully clickable despite animation
- On hover: individual card lifts slightly (scale + shadow), row animation pauses for that row
- Mobile: motion disabled automatically, normal masonry static

**Technical approach:**
- CSS `@keyframes` + `animation` on row wrapper elements
- `will-change: transform` for performance
- IntersectionObserver to pause rows outside viewport
- `prefers-reduced-motion` media query fully respected

### Design B — Blog Cloud (Grouped Float Layout)

**Behavior:**
- Post cards float in a physics-ish space, loosely clustered by filter group
- When no filter active: gentle random drift, cards bounce softly off boundaries
- When filter applied: cards in matching group gravitate together, others shrink and float to edges
- Clusters labeled with group name in elegant large ghost type
- Hover a card: it expands slightly, others in its cluster respond subtly

**Technical approach:**
- React + `framer-motion` `AnimatePresence` + spring physics
- D3-force layout for cluster positioning (lightweight, no full D3 bundle needed)
- Cards use `motion.div` with drag constraints for playful interactivity

### Design C — Editorial Stack
*(Bonus, simpler — for clients who want clean not kinetic)*
- Full-width featured post at top, 2-col grid below, alternating wide/narrow cards
- Beautiful typographic hierarchy, no animation except subtle fade-in on scroll

### Global Filter System (applies to all Index Designs)
Filters appear as a floating pill-bar above the grid:
- **By Keyword / Pillar** — shows only posts in that keyword silo
- **Recent Only** — time-range slider (last 7 / 30 / 90 days)
- **Post Type** — Pillar only, Supportive only, All
- **Reading Time** — quick reads (<5 min), deep dives (10+ min)
- Filters animate gracefully: non-matching cards scale down and fade (not hard-removed from DOM — keeps layout stable)
- URL param sync: filters are shareable/bookmarkable

---

## 8. Individual Post Design System

### Typography Controls (per H level + Body)
Accessible in left sidebar, apply globally to post:
- **Line Height (Leading):** slider, 1.0–2.5, in 0.05 increments
- **Letter Spacing (Tracking):** -0.05em to +0.2em slider
- **Font Size:** relative scale (S/M/L/XL per level, not raw px — theme-safe)
- Changes shown live in editor

### Drop Caps
Toggle per post (or set as default in blog settings):

**Style A — Script Float**
- First letter of first paragraph rendered in a decorative script/display font (Playfair Display, Cormorant Garamond, or similar — admin-selectable)
- Floated left, 3 lines tall, subtle color (theme accent or custom)
- Clean text wrap

**Style B — Boxed Initial**
- Same letter but bounded by a solid or outlined box
- Box color from theme palette — admin-selectable
- Slight shadow option
- Works especially well on feature/pillar posts

### Auto Info Cards (Smart Block)
When enabled, the system scans post content and auto-generates inline info cards anchored to the nearest H2 or H3:

**Card anatomy:**
- Left: greyscale or colored React Icon (auto-selected from topic keyword, admin can override)
- Right: 1–2 sentence key takeaway derived from the section (AI-generated, editable)
- Optional: drop shadow, colored border, background tint

**Triggers:**
- Admin can manually insert a card anywhere via `/infocard` slash command in editor
- Auto-suggestion mode: system highlights spots where a card would improve scannability

### Template System
- 3–5 base templates: Editorial, Technical/How-To, Listicle, Case Study, Interview
- Templates control: layout proportions, header image style, drop-cap defaults, info card density, table of contents style
- Templates are starting points — every element overridable
- Admin can save a customized post as a new template ("Save as Template" in sidebar)

---

## 9. Image System

### Source A — AI Image Generation (BYOK)
- Admin types image request in chat OR clicks "Generate Image" in sidebar
- System reads nearest H1/H2/H3 text, pre-fills a generation prompt (admin can edit)
- Model selector: admin picks image model (DALL-E 3, Flux, Ideogram, etc. via OpenRouter or direct)
- Image opens in **Image Studio Tab** — grid of 4 generations
- Click to select → inserted at cursor or at heading position

### Source B — Stock Photo Search
Searches simultaneously across:
- **Unsplash** (API, free, high quality, attribution auto-handled)
- **Pexels** (API, free, no attribution required)
- **Pixabay** (API, truly free, no attribution required — good for commercial use)
- **Flickr Creative Commons** (API, filtered to CC0/CC-BY — auto-records attribution)

**Auto-context matching:**
- Query is auto-built from: H1/H2/H3 text nearest the cursor position
- Query uses extracted nouns + topic keyword (not full heading — cleaned intelligently)
- Results shown in Image Studio Tab as a unified grid (source badge on each)
- Admin can override the auto-query and type their own search

### Auto-SEO on Image Insert
Regardless of source (AI or stock), on image insertion:
- **Alt Text** auto-generated: "[primary keyword] — [brief description of image content]"
- **Caption** auto-generated: descriptive sentence matching nearby heading context
- Both shown in a quick-edit popover immediately after insertion
- Admin edits in-place (most won't — that's the point)
- Attribution (for Flickr CC) auto-appended to caption in small text

---

## 10. Auto-Build SEO System (Background Automation)

Every post auto-generates on save/publish without admin input:

| What | How |
|---|---|
| Meta Title | AI draft from H1 + keyword, truncated to 58 chars |
| Meta Description | AI draft from intro paragraph, truncated to 155 chars |
| Open Graph image | Auto-selected from post hero image or AI-generated fallback |
| Canonical URL | Auto-set, admin can override |
| JSON-LD Schema | `Article` or `HowTo` or `FAQPage` based on post template |
| Internal links | Suggests links to related Pillar/Supportive posts inline (yellow underline, admin accepts or dismisses) |
| Slug | Cleaned from title, keyword-first, no stop words |
| Reading time | Calculated and added to post meta |
| Table of Contents | Auto-generated from H2/H3 structure, injected at top if enabled |

---

## 11. Recommended Third-Party APIs — Quick Reference

| Function | Primary Recommendation | Alternative | Notes |
|---|---|---|---|
| AI Detection | **Originality.ai** | GPTZero, Winston AI | BYOK recommended; sentence-level highlighting |
| Humanization | **Undetectable.ai** | Humanizer.pro, WriteHuman | Platform upsell option; poll-based async |
| RSS Aggregation | **RSS.app API** | Feedly API, Superfeedr | RSS.app simplest; Feedly richer but pricier |
| Stock Images | **Unsplash + Pexels + Pixabay** | Flickr CC | Run in parallel, unify results |
| AI Image Gen | **OpenRouter (Flux/DALL-E)** | Direct BYOK | OpenRouter gives model flexibility |
| AI Writing | **OpenRouter** | Direct BYOK | Model-agnostic is the right call |

---

## 12. Build Sequence Recommendation

Given the interdependencies, build in this order:

1. **Silo Manager** (data model first — everything else depends on it)
2. **Editor Shell** (3-panel layout + tab bar, no content yet)
3. **Rich Text Editor** (block editor core — TipTap recommended over Slate for this use case)
4. **Left Sidebar Controls** (wire up to editor state)
5. **BYOK Settings** (API key vault, model selector — needed by all AI features)
6. **AI Chat (right sidebar)** (shared CMS component, just needs post context injection)
7. **RSS Feed Panel** (feed management + 3 action choices)
8. **AI Detection integration** (Originality.ai or GPTZero)
9. **Humanization flow** (BYOK prompt first, Undetectable.ai second)
10. **Image System** (stock search first, AI gen second)
11. **Auto-SEO background jobs** (meta, schema, slug, TOC)
12. **Typography Controls + Drop Caps** (design layer, late-stage polish)
13. **Info Cards** (smart block system)
14. **Blog Index Designs** (Kinetic Masonry, Blog Cloud, Editorial Stack)
15. **Post Templates** (last — needs all design primitives in place)

---

*This spec is a living document. API choices should be validated against current pricing before integration. All BYOK flows should store keys encrypted (AES-256) in the admin's own database — never in platform storage.*
