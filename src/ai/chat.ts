import type { ContentSlot, PageContent, SlotChange } from '../content/types.js';

export interface ChatRequest {
  message: string;
  content: PageContent;
  pageTitle?: string;
}

export interface ChatResponse {
  changes: SlotChange[];
  explanation: string;
  provider: 'anthropic' | 'openrouter';
}

const SYSTEM_PROMPT = `You are a content editor assistant for a locked-template CMS.
You MUST NOT write HTML, CSS, JavaScript, or code of any kind.
You only propose content slot value changes as JSON.

Each page has content slots with id, type (text|image|link|button), and current value.
Respond with ONLY valid JSON in this shape:
{
  "explanation": "brief plain-English summary of what you changed",
  "changes": [
    { "slotId": "...", "value": "new text", "href": "optional for links", "alt": "optional for images" }
  ]
}

Rules:
- Only modify slots that exist in the provided slot list.
- Never empty heading (h1-h6) slots.
- Never remove slots or add new ones.
- Keep changes minimal and faithful to the user's request.
- For link slots, include href when changing the destination.`;

export function buildUserPrompt(req: ChatRequest): string {
  const slotSummary = req.content.slotOrder
    .map((id) => {
      const s = req.content.slots[id];
      const extras =
        s.type === 'link' ? ` href="${s.href ?? ''}"` : s.type === 'image' ? ` alt="${s.alt ?? ''}"` : '';
      return `- ${id} (${s.type}, <${s.tag}>): "${s.value}"${extras}`;
    })
    .join('\n');

  return `Page: ${req.pageTitle ?? 'Untitled'}

Current slots:
${slotSummary}

User request: ${req.message}`;
}

export async function proposeChanges(req: ChatRequest): Promise<ChatResponse> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (anthropicKey) {
    return callAnthropic(req, anthropicKey);
  }
  if (openRouterKey) {
    return callOpenRouter(req, openRouterKey);
  }
  throw new Error('No AI provider configured — set ANTHROPIC_API_KEY or OPENROUTER_API_KEY');
}

async function callAnthropic(req: ChatRequest, apiKey: string): Promise<ChatResponse> {
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(req) }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = data.content.find((c) => c.type === 'text')?.text ?? '';
  return parseAiJson(text, 'anthropic');
}

async function callOpenRouter(req: ChatRequest, apiKey: string): Promise<ChatResponse> {
  const model = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL ?? 'http://localhost:3001',
      'X-Title': 'ClaudePress',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(req) },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = data.choices[0]?.message?.content ?? '';
  return parseAiJson(text, 'openrouter');
}

function parseAiJson(text: string, provider: 'anthropic' | 'openrouter'): ChatResponse {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI did not return valid JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    explanation?: string;
    changes?: SlotChange[];
  };

  if (!Array.isArray(parsed.changes) || parsed.changes.length === 0) {
    throw new Error('AI returned no slot changes');
  }

  return {
    changes: parsed.changes,
    explanation: parsed.explanation ?? 'Changes proposed',
    provider,
  };
}
