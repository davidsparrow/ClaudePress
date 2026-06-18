import { describe, it, expect } from 'vitest';
import {
  buildFullPostText,
  buildHashtagLine,
  slugifyTag,
  PLATFORM_LIMITS,
} from '../content/social-types.js';
import { extractBlogSections, pickNextSection } from '../social/sections.js';

describe('social-types', () => {
  it('slugifyTag strips hash and spaces', () => {
    expect(slugifyTag('#Hello World')).toBe('HelloWorld');
    expect(slugifyTag('  foo-bar  ')).toBe('foobar');
  });

  it('buildHashtagLine joins tags', () => {
    expect(buildHashtagLine(['one', 'two'])).toBe('#one #two');
    expect(buildHashtagLine(['SEO tips', 'content'])).toBe('#SEOtips #content');
  });

  it('buildFullPostText combines caption and hashtags', () => {
    expect(buildFullPostText('Hello world', ['tag1'])).toBe('Hello world\n\n#tag1');
    expect(buildFullPostText('Caption only', [])).toBe('Caption only');
  });

  it('platform char limits are defined', () => {
    expect(PLATFORM_LIMITS.x.maxChars).toBe(280);
    expect(PLATFORM_LIMITS.linkedin.maxChars).toBe(3000);
    expect(PLATFORM_LIMITS.facebook.warnAt).toBe(500);
  });
});

describe('section rotation', () => {
  const sections = [
    { slug: 'intro', heading: 'Intro', excerpt: 'First' },
    { slug: 'benefits', heading: 'Benefits', excerpt: 'Second' },
    { slug: 'faq', heading: 'FAQ', excerpt: 'Third' },
  ];

  it('picks unused section first', () => {
    const pick = pickNextSection(sections, { runCount: 1, usedSections: ['intro'] });
    expect(pick.section.slug).toBe('benefits');
    expect(pick.overlap).toBe(false);
  });

  it('allows overlap when all sections used', () => {
    const pick = pickNextSection(sections, {
      runCount: 3,
      usedSections: ['intro', 'benefits', 'faq'],
    });
    expect(pick.overlap).toBe(true);
    expect(pick.section).toBeDefined();
  });

  it('extractBlogSections from HTML', () => {
    const html = '<h2>First</h2><p>Para one.</p><h3>Second</h3><p>Para two.</p>';
    const out = extractBlogSections(html);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0].heading).toBe('First');
  });
});
