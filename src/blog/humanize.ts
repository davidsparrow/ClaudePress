import { resolveAiKeys } from '../integrations/resolve.js';

const HUMANIZE_PROMPT = `Rewrite the HTML content to sound more human and natural. Vary sentence length, use conversational tone, avoid AI patterns. Return ONLY the rewritten HTML body — no markdown fences, no explanation.`;

export async function humanizeHtml(html: string): Promise<string> {
  const ai = await resolveAiKeys();
  if (!ai) throw new Error('No AI provider configured for humanize');

  const res =
    ai.provider === 'anthropic'
      ? await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ai.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: ai.model,
            max_tokens: 4096,
            system: HUMANIZE_PROMPT,
            messages: [{ role: 'user', content: html }],
          }),
        })
      : await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ai.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: ai.model,
            messages: [
              { role: 'system', content: HUMANIZE_PROMPT },
              { role: 'user', content: html },
            ],
          }),
        });

  if (!res.ok) throw new Error(`Humanize API error: ${res.status}`);

  const data = await res.json();
  if (ai.provider === 'anthropic') {
    return (data as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? html;
  }
  return (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? html;
}
