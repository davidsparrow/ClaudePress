import { describe, it, expect } from 'vitest';
import {
  slugify,
  templateToPhp,
  buildWordPressTheme,
  pageSlug,
} from '../wordpress/export.js';
import type { Site } from '../storage/types.js';

const site: Site = {
  meta: {
    id: 'abc123',
    name: 'Acme Corp',
    domain: 'acme.com',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  pages: [
    {
      id: 'p1',
      path: '/',
      title: 'Home',
      content: {
        template: '<h1>{{slot:h1}}</h1><p>{{slot:p1}}</p>',
        slots: {
          h1: { id: 'h1', type: 'text', value: 'Welcome', tag: 'h1', path: 'h1[0]' },
          p1: { id: 'p1', type: 'text', value: 'Hello world', tag: 'p', path: 'p[0]' },
        },
        slotOrder: ['h1', 'p1'],
      },
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'p2',
      path: '/about',
      title: 'About',
      content: {
        template: '<p>{{slot:a1}}</p>',
        slots: {
          a1: { id: 'a1', type: 'text', value: 'About us', tag: 'p', path: 'p[0]' },
        },
        slotOrder: ['a1'],
      },
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
};

describe('WordPress export', () => {
  it('slugifies theme names', () => {
    expect(slugify('Acme Corp!')).toBe('acme-corp');
  });

  it('converts slot placeholders to PHP', () => {
    const php = templateToPhp('<h1>{{slot:text-h1-0}}</h1>');
    expect(php).toContain("claudepress_slot('text-h1-0')");
    expect(php).not.toContain('{{slot:');
  });

  it('builds a complete theme file set', () => {
    const theme = buildWordPressTheme(site);
    expect(theme.themeSlug).toBe('freshpress-acme-corp');
    expect(theme.files['style.css']).toContain('Theme Name: Acme Corp');
    expect(theme.files['functions.php']).toContain('claudepress_activate_theme');
    expect(theme.files['inc/slots.json']).toContain('"h1"');
    expect(theme.files['front-page.php']).toContain('claudepress_slot');
    expect(theme.files['page-about.php']).toBeDefined();
    expect(theme.files['INSTALL.md']).toContain('Settings → Reading');
    expect(theme.files['ANIMATIONS.md']).toContain('Framer Motion');
    expect(pageSlug(site.pages[1])).toBe('about');
  });
});
