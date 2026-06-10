import * as cheerio from 'cheerio';
import type { Site, SitePage } from '../storage/types.js';

export interface WordPressThemeExport {
  themeSlug: string;
  themeName: string;
  files: Record<string, string>;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'presspal-site';
}

export function pageSlug(page: SitePage): string {
  if (page.path === '/') return 'home';
  return slugify(page.path.replace(/^\//, '').replace(/\//g, '-'));
}

/** Convert PressPal slot placeholders to PHP helper calls */
export function templateToPhp(template: string): string {
  const regex = /\{\{slot:([^}]+)\}\}/g;
  return template.replace(regex, (_match, id: string) => {
    const safeId = id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `<?php claudepress_slot('${safeId}'); ?>`;
  });
}

export interface ExtractedAssets {
  styles: string[];
  scripts: string[];
  animationHints: string[];
}

/** Pull inline styles/scripts and detect animation libraries from HTML */
export function extractAssetsFromHtml(html: string): ExtractedAssets {
  const styles: string[] = [];
  const scripts: string[] = [];
  const animationHints = new Set<string>();

  const $ = cheerio.load(html, { xml: false });
  $('style').each((_, el) => {
    const css = $(el).html()?.trim();
    if (css) styles.push(css);
  });
  $('script').each((_, el) => {
    const src = $(el).attr('src');
    const inline = $(el).html()?.trim();
    if (src) scripts.push(`// external: ${src}`);
    else if (inline) scripts.push(inline);
  });

  const blob = html.toLowerCase();
  if (blob.includes('framer-motion') || blob.includes('motion.')) animationHints.add('Framer Motion (React)');
  if (blob.includes('gsap') || blob.includes('scrolltrigger')) animationHints.add('GSAP / ScrollTrigger');
  if (blob.includes('aos') || blob.includes('data-aos')) animationHints.add('AOS (Animate On Scroll)');
  if (blob.includes('@keyframes') || blob.includes('animation:')) animationHints.add('CSS @keyframes');
  if (blob.includes('lottie') || blob.includes('bodymovin')) animationHints.add('Lottie animations');
  if (blob.includes('three.js') || blob.includes('threejs')) animationHints.add('Three.js / WebGL');
  if (blob.includes('swiper')) animationHints.add('Swiper carousel');
  if (blob.includes('intersectionobserver') || blob.includes('fade-in')) animationHints.add('Scroll reveal / fade-in');

  return { styles, scripts, animationHints: [...animationHints] };
}

export function buildWordPressTheme(site: Site): WordPressThemeExport {
  if (site.pages.length === 0) {
    throw new Error('No pages to export');
  }

  const themeSlug = `presspal-${slugify(site.meta.name)}`;
  const themeName = site.meta.name;
  const files: Record<string, string> = {};

  const allSlots: Record<string, unknown> = {};
  const allAnimationHints = new Set<string>();
  const combinedStyles: string[] = [];

  for (const page of site.pages) {
    for (const [id, slot] of Object.entries(page.content.slots)) {
      allSlots[id] = slot;
    }
    const rendered = page.content.template;
    const assets = extractAssetsFromHtml(rendered);
    assets.animationHints.forEach((h) => allAnimationHints.add(h));
    combinedStyles.push(...assets.styles);
  }

  files['style.css'] = buildStyleCss(themeName, themeSlug, combinedStyles);
  files['functions.php'] = FUNCTIONS_PHP;
  files['inc/slots.php'] = SLOTS_PHP;
  files['inc/slots.json'] = JSON.stringify(allSlots, null, 2);
  files['header.php'] = HEADER_PHP;
  files['footer.php'] = FOOTER_PHP;
  files['index.php'] = INDEX_PHP;

  for (const page of site.pages) {
    const phpBody = templateToPhp(page.content.template);
    const slug = pageSlug(page);

    if (page.path === '/') {
      files['front-page.php'] = buildPageTemplate(page.title, phpBody, 'Front Page');
    } else {
      files[`page-${slug}.php`] = buildPageTemplate(page.title, phpBody, page.title);
    }
  }

  if (!files['front-page.php']) {
    const first = site.pages[0];
    files['front-page.php'] = buildPageTemplate(
      first.title,
      templateToPhp(first.content.template),
      'Front Page'
    );
  }

  files['assets/theme.css'] = combinedStyles.length
    ? combinedStyles.join('\n\n')
    : '/* Add custom styles — exported from PressPal frozen template */\n';

  files['INSTALL.md'] = buildInstallMd(themeName, themeSlug, site);
  files['ANIMATIONS.md'] = buildAnimationsMd([...allAnimationHints]);
  files['README.md'] = buildReadmeMd(themeName);

  return { themeSlug, themeName, files };
}

function buildPageTemplate(title: string, bodyPhp: string, templateName: string): string {
  return `<?php
/**
 * Template Name: ${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}
 * PressPal export — ${templateName}
 */
get_header();
?>

<main class="claudepress-page">
${bodyPhp}
</main>

<?php get_footer(); ?>
`;
}

function buildStyleCss(themeName: string, themeSlug: string, styles: string[]): string {
  const extra = styles.length ? `\n/* --- Exported inline styles --- */\n${styles.join('\n')}\n` : '';
  return `/*
Theme Name: ${themeName}
Theme URI: https://github.com/davidsparrow/ClaudePress
Author: PressPal
Author URI: https://github.com/davidsparrow/ClaudePress
Description: Custom theme exported from PressPal CMS. Editable content slots are stored in inc/slots.json.
Version: 1.0.0
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 8.0
Text Domain: ${themeSlug}
*/

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
}

.claudepress-page {
  min-height: 60vh;
}
${extra}`;
}

function buildInstallMd(themeName: string, themeSlug: string, site: Site): string {
  const pages = site.pages
    .map((p) => `- **${p.title}** — path \`${p.path}\` → WordPress page slug \`${pageSlug(p)}\``)
    .join('\n');

  return `# WordPress Install Guide — ${themeName}

This theme was exported from **PressPal CMS**. The design layout is frozen in PHP templates; editable text and images live in \`inc/slots.json\`.

## 1. Upload the theme

1. Zip the \`${themeSlug}/\` folder (or upload as-is if WordPress accepts the folder).
2. In WordPress admin go to **Appearance → Themes → Add New → Upload Theme**.
3. Upload the zip and click **Install Now**, then **Activate**.

**Or via FTP/SFTP:** copy the theme folder to \`wp-content/themes/${themeSlug}/\`.

## 2. Create matching pages

Create a WordPress page for each exported route:

${pages}

For each page:
1. **Pages → Add New**
2. Set the **title** to match the list above
3. Set the **permalink/slug** to match (e.g. \`about\` for \`/about\`)
4. In the right sidebar under **Template**, choose the matching **Template Name** (same as page title)
5. Publish

## 3. Set the homepage

1. **Settings → Reading**
2. Select **A static page**
3. Choose your home page for **Homepage** (the page using \`front-page.php\`)

## 4. Permalinks

Go to **Settings → Permalinks** and click **Save** (even without changes) to flush rewrite rules.

## 5. Edit content (slots)

Default slot values are in \`inc/slots.json\`. On theme activation they load into the WordPress option \`claudepress_slots\`.

To update content programmatically:
\`\`\`php
$slots = get_option('claudepress_slots', []);
$slots['your-slot-id']['value'] = 'New headline text';
update_option('claudepress_slots', $slots);
\`\`\`

For client-friendly editing, consider:
- **Advanced Custom Fields (ACF)** — map slot IDs to field groups
- **Customiser** — extend \`functions.php\` with \`customize_register\` hooks
- Re-import from PressPal after edits and re-upload the theme

## 6. Contact forms

If you used PressPal contact forms, point forms to your PressPal server or replace with:
- **Contact Form 7**
- **WPForms**
- **Gravity Forms**

## 7. Need help?

See \`ANIMATIONS.md\` for motion/animation migration tips from React sites.
`;
}

function buildAnimationsMd(hints: string[]): string {
  const detected =
    hints.length > 0
      ? hints.map((h) => `- ${h}`).join('\n')
      : '- No specific animation libraries detected in exported HTML';

  return `# Animation & Motion — React to WordPress

Your PressPal site may have used React-based animations. WordPress themes are PHP + HTML + CSS. Use this guide to recreate similar effects.

## Detected in your export

${detected}

---

## General approach

1. **Prefer CSS first** — transitions, \`@keyframes\`, \`scroll-driven animations\` (modern browsers)
2. **Use lightweight JS plugins** only when CSS is not enough
3. **Avoid bundlers** in classic PHP themes unless you add a build step

---

## Common React → WordPress mappings

| React / npm | WordPress approach |
|-------------|-------------------|
| **Framer Motion** | CSS transitions + \`Intersection Observer\` (see \`assets/theme.css\`) or **GreenSock (GSAP)** |
| **GSAP / ScrollTrigger** | Enqueue GSAP from CDN in \`functions.php\`, or plugin **Scroll Magic** |
| **AOS (Animate On Scroll)** | Plugin **[Animate On Scroll](https://wordpress.org/plugins/animate-on-scroll/)** or copy AOS CSS/JS |
| **React Spring** | CSS \`transition\` + small vanilla JS |
| **Lottie (React)** | Plugin **Bodymovin / Lottie** or embed JSON via **Elementor** |
| **Three.js / WebGL** | **Spline** embed, static hero video, or simplified CSS parallax |
| **Swiper (React)** | Plugin **Swiper for WordPress** or enqueue Swiper.js in \`functions.php\` |
| **CSS modules / Tailwind** | Paste utility classes into \`assets/theme.css\` or use **Tailwind CLI** build |

---

## Recommended WordPress plugins

- **[Animate On Scroll](https://wordpress.org/plugins/animate-on-scroll/)** — scroll reveal (AOS-style)
- **[GreenShift](https://wordpress.org/plugins/greenshift-animation-and-page-builder-blocks/)** — CSS animations + blocks
- **[Advanced Animations](https://wordpress.org/plugins/advanced-animations/)** — lightweight motion blocks
- **Contact Form 7 / WPForms** — replace React form components

---

## CSS scroll reveal (no plugin)

Add to \`assets/theme.css\`:

\`\`\`css
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.is-visible {
  opacity: 1;
  transform: none;
}
\`\`\`

Add to \`functions.php\` (footer):

\`\`\`php
add_action('wp_footer', function () {
  echo '<script>
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("is-visible"); });
    }, { threshold: 0.15 });
    els.forEach(el => io.observe(el));
  </script>';
});
\`\`\`

Add class \`reveal\` to sections in your page templates.

---

## GSAP via CDN (advanced)

In \`functions.php\`:

\`\`\`php
function claudepress_enqueue_gsap() {
  wp_enqueue_script('gsap', 'https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js', [], null, true);
  wp_enqueue_script('gsap-scrolltrigger', 'https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js', ['gsap'], null, true);
}
add_action('wp_enqueue_scripts', 'claudepress_enqueue_gsap');
\`\`\`

Then add ScrollTrigger timelines in a custom \`assets/animations.js\` file.

---

## Tips

- Export hero videos instead of canvas/WebGL when possible
- Test on mobile — reduce motion with \`prefers-reduced-motion: reduce\`
- Keep animation subtle for SEO Core Web Vitals (LCP, CLS)
`;
}

function buildReadmeMd(themeName: string): string {
  return `# ${themeName} — PressPal WordPress Theme

Exported from [PressPal CMS](https://github.com/davidsparrow/ClaudePress).

- **INSTALL.md** — step-by-step WordPress setup
- **ANIMATIONS.md** — recreate React motion with CSS/plugins
- **inc/slots.json** — editable content values
- **inc/slots.php** — \`claudepress_slot()\` renderer
`;
}

const HEADER_PHP = `<?php
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
`;

const FOOTER_PHP = `<?php wp_footer(); ?>
</body>
</html>
`;

const INDEX_PHP = `<?php
get_header();
?>
<main class="claudepress-page">
  <?php
  if (have_posts()) {
    while (have_posts()) {
      the_post();
      the_content();
    }
  }
  ?>
</main>
<?php get_footer(); ?>
`;

const SLOTS_PHP = `<?php
/**
 * PressPal slot renderer — reads from claudepress_slots option.
 */

function claudepress_get_slots(): array {
  $slots = get_option('claudepress_slots');
  if (is_array($slots)) {
    return $slots;
  }
  $path = get_template_directory() . '/inc/slots.json';
  if (file_exists($path)) {
    $decoded = json_decode(file_get_contents($path), true);
    return is_array($decoded) ? $decoded : [];
  }
  return [];
}

function claudepress_slot(string $id): void {
  $slots = claudepress_get_slots();
  if (!isset($slots[$id]) || !is_array($slots[$id])) {
    return;
  }
  $slot = $slots[$id];
  $type = $slot['type'] ?? 'text';
  $value = $slot['value'] ?? '';

  switch ($type) {
    case 'image':
      $alt = esc_attr($slot['alt'] ?? '');
      echo '<img src="' . esc_url($value) . '" alt="' . $alt . '" />';
      break;
    case 'link':
      $href = esc_url($slot['href'] ?? '#');
      echo '<a href="' . $href . '">' . esc_html($value) . '</a>';
      break;
    case 'button':
      echo '<button type="button">' . esc_html($value) . '</button>';
      break;
    case 'text':
    default:
      echo esc_html($value);
      break;
  }
}
`;

const FUNCTIONS_PHP = `<?php
/**
 * PressPal WordPress theme — exported from PressPal CMS
 */

require_once get_template_directory() . '/inc/slots.php';

function claudepress_theme_setup(): void {
  add_theme_support('title-tag');
  add_theme_support('post-thumbnails');
  add_theme_support('html5', ['search-form', 'comment-form', 'gallery', 'caption', 'style', 'script']);
}
add_action('after_setup_theme', 'claudepress_theme_setup');

function claudepress_enqueue_assets(): void {
  wp_enqueue_style(
    'claudepress-theme',
    get_template_directory_uri() . '/assets/theme.css',
    [],
    '1.0.0'
  );
}
add_action('wp_enqueue_scripts', 'claudepress_enqueue_assets');

function claudepress_activate_theme(): void {
  $path = get_template_directory() . '/inc/slots.json';
  if (!file_exists($path)) {
    return;
  }
  $decoded = json_decode(file_get_contents($path), true);
  if (is_array($decoded)) {
    update_option('claudepress_slots', $decoded);
  }
}
add_action('after_switch_theme', 'claudepress_activate_theme');
`;
