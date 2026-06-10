import { describe, it, expect } from 'vitest';
import { parseDesignMdHeuristic } from './parse-design-md.js';

describe('parseDesignMdHeuristic', () => {
  it('extracts colors and fonts from DESIGN.md-like content', () => {
    const raw = `# Vercel\nPrimary: #000000\nAccent: #0070f3\nFont: Geist, Inter`;
    const guide = parseDesignMdHeuristic(raw, 'vercel', 'Vercel', 'Minimalist');
    expect(guide.colors.primary).toBe('#000000');
    expect(guide.meta.sourceRef).toBe('vercel');
    expect(guide.cssVariables).toContain('--fp-primary');
  });
});
