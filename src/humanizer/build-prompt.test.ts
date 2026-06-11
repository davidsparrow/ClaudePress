import { describe, expect, it } from 'vitest';
import { substitutePlaceholders } from './build-prompt.js';
import { stripFrontmatter } from './loader.js';

describe('stripFrontmatter', () => {
  it('removes YAML frontmatter', () => {
    const raw = `---
name: test
---
# Body`;
    expect(stripFrontmatter(raw)).toBe('# Body');
  });
});

describe('substitutePlaceholders', () => {
  const config = {
    siteId: 's1',
    mode: 'skill' as const,
    tone: 'friendly-professional',
    readingLevel: "Bachelor's degree in liberal arts",
    voiceSample: 'I write short sentences.',
    contentTypeHint: 'auto' as const,
    updatedAt: '2026-01-01',
  };

  it('replaces tone and reading level', () => {
    const out = substitutePlaceholders('Tone: {{TONE}} Level: {{READING_LEVEL}}', config, 'blog');
    expect(out).toContain('friendly-professional');
    expect(out).toContain("Bachelor's degree in liberal arts");
  });

  it('includes voice sample block when present', () => {
    const out = substitutePlaceholders('{{VOICE_SAMPLE_BLOCK}}', config, 'blog');
    expect(out).toContain('I write short sentences.');
  });

  it('includes custom augment when present', () => {
    const withAugment = { ...config, customAugment: 'Never use em dashes.' };
    const out = substitutePlaceholders('{{CUSTOM_AUGMENT}}', withAugment, 'email');
    expect(out).toContain('Never use em dashes.');
  });
});
