import { describe, it, expect } from 'vitest';
import { buildUserPrompt } from '../ai/chat.js';
import type { PageContent } from '../content/types.js';

const content: PageContent = {
  template: '<h1>{{slot:a}}</h1>',
  slots: {
    a: { id: 'a', type: 'text', value: 'Hello', tag: 'h1', path: 'h1[0]' },
  },
  slotOrder: ['a'],
};

describe('buildUserPrompt', () => {
  it('includes slot list and user message', () => {
    const prompt = buildUserPrompt({ message: 'Make it say Welcome', content, pageTitle: 'Home' });
    expect(prompt).toContain('Hello');
    expect(prompt).toContain('Make it say Welcome');
    expect(prompt).toContain('a (text');
  });
});
