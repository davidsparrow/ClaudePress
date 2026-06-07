import { describe, it, expect } from 'vitest';
import { ingestHtml } from '../ingest/index.js';
import { renderPage } from '../content/render.js';
import { validateChanges, mergeValidatedSlots } from '../guardian/validate.js';

const SAMPLE_HTML = `<!DOCTYPE html>
<html><head><title>Test Site</title></head>
<body>
  <header><h1>Welcome</h1></header>
  <main>
    <p>First paragraph.</p>
    <p>Second paragraph.</p>
    <a href="/about">About us</a>
    <button>Click me</button>
    <img src="/hero.jpg" alt="Hero image" />
  </main>
</body></html>`;

describe('ingest', () => {
  it('extracts editable slots from HTML', () => {
    const result = ingestHtml('https://example.com/', SAMPLE_HTML);
    expect(result.title).toBe('Test Site');
    expect(Object.keys(result.content.slots).length).toBeGreaterThan(0);
    expect(result.content.template).toContain('{{slot:');
  });

  it('renders back to readable HTML', () => {
    const result = ingestHtml('https://example.com/', SAMPLE_HTML);
    const html = renderPage(result.content);
    expect(html).toContain('Welcome');
    expect(html).toContain('First paragraph');
    expect(html).toContain('href="/about"');
    expect(html).toContain('src="/hero.jpg"');
  });
});

describe('Guardian', () => {
  it('accepts valid text changes', () => {
    const { content } = ingestHtml('https://example.com/', SAMPLE_HTML);
    const slotId = content.slotOrder.find((id) => content.slots[id].value === 'First paragraph.')!;
    const result = validateChanges(content, [{ slotId, value: 'Updated paragraph.' }]);
    expect(result.ok).toBe(true);
  });

  it('rejects script injection', () => {
    const { content } = ingestHtml('https://example.com/', SAMPLE_HTML);
    const slotId = content.slotOrder.find((id) => content.slots[id].type === 'text')!;
    const result = validateChanges(content, [{ slotId, value: '<script>alert(1)</script>' }]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('script'))).toBe(true);
  });

  it('rejects emptying structural headings', () => {
    const { content } = ingestHtml('https://example.com/', SAMPLE_HTML);
    const slotId = content.slotOrder.find((id) => content.slots[id].tag === 'h1')!;
    const result = validateChanges(content, [{ slotId, value: '   ' }]);
    expect(result.ok).toBe(false);
  });

  it('rejects unknown slots', () => {
    const { content } = ingestHtml('https://example.com/', SAMPLE_HTML);
    const result = validateChanges(content, [{ slotId: 'fake-slot', value: 'nope' }]);
    expect(result.ok).toBe(false);
  });

  it('applies valid link href changes', () => {
    const { content } = ingestHtml('https://example.com/', SAMPLE_HTML);
    const slotId = content.slotOrder.find((id) => content.slots[id].type === 'link')!;
    const result = validateChanges(content, [{ slotId, href: 'https://example.org/new' }]);
    expect(result.ok).toBe(true);
    const updated = mergeValidatedSlots(content, result.applied!);
    expect(updated.slots[slotId].href).toBe('https://example.org/new');
  });
});
