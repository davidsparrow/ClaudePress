import { resolveAiKeys } from '../integrations/resolve.js';
import { getStyleGuideStore } from '../storage/style-guides.js';
import { getHumanizerConfigStore } from '../storage/humanizer-config.js';
import {
  buildHumanizerPrompt,
  buildUserMessage,
  SIMPLE_HUMANIZE_PROMPT,
} from './build-prompt.js';
import type { HumanizeOptions, HumanizeResult, HumanizerMode, HumanizerReview } from './types.js';

async function callAi(system: string, user: string, maxTokens: number): Promise<string> {
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
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: user }],
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
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        });

  if (!res.ok) throw new Error(`Humanize API error: ${res.status}`);

  const data = await res.json();
  if (ai.provider === 'anthropic') {
    return (data as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '';
  }
  return (
    (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message
      ?.content ?? ''
  );
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json|html)?\s*([\s\S]*?)```$/i);
  return fence ? fence[1].trim() : trimmed;
}

function parseSkillResponse(raw: string, fallbackHtml: string): HumanizeResult {
  const cleaned = stripCodeFences(raw);
  try {
    const parsed = JSON.parse(cleaned) as {
      humanizedHtml?: string;
      review?: HumanizerReview;
    };
    if (parsed.humanizedHtml) {
      return {
        humanizedHtml: parsed.humanizedHtml,
        mode: 'skill',
        review: parsed.review,
      };
    }
  } catch {
    // not JSON — treat as raw HTML
  }
  if (cleaned.includes('<') && cleaned.includes('>')) {
    return { humanizedHtml: cleaned, mode: 'skill' };
  }
  return { humanizedHtml: fallbackHtml, mode: 'skill' };
}

async function resolveMode(siteId: string, mode?: HumanizerMode): Promise<HumanizerMode> {
  if (mode) return mode;
  const store = await getHumanizerConfigStore();
  const site = await store.getSiteConfig(siteId);
  const workspace = await store.getWorkspaceDefaults();
  return site?.mode ?? workspace.defaultMode ?? 'simple';
}

export async function humanizeHtml(options: HumanizeOptions): Promise<HumanizeResult> {
  const { html, siteId, contentType = 'auto', includeReview = false } = options;
  const mode = await resolveMode(siteId, options.mode);

  if (mode === 'simple') {
    const text = await callAi(SIMPLE_HUMANIZE_PROMPT, html, 4096);
    return { humanizedHtml: stripCodeFences(text) || html, mode: 'simple' };
  }

  const configStore = await getHumanizerConfigStore();
  const config = await configStore.getOrCreateSiteConfig(siteId);
  const styleGuide = await getStyleGuideStore().then((s) => s.get(siteId));
  const styleAddition =
    styleGuide && 'aiSystemPromptAddition' in styleGuide
      ? String((styleGuide as { aiSystemPromptAddition?: string }).aiSystemPromptAddition ?? '')
      : undefined;

  const resolvedType =
    contentType === 'auto' ? config.contentTypeHint ?? 'auto' : contentType;

  const system = await buildHumanizerPrompt({
    config,
    contentType: resolvedType,
    includeReview,
    styleGuideAddition: styleAddition,
  });

  const user = buildUserMessage(html, includeReview);
  const maxTokens = includeReview ? 8192 : 4096;
  const raw = await callAi(system, user, maxTokens);
  return parseSkillResponse(raw, html);
}

/** @deprecated Use humanizeHtml({ html, siteId }) — kept for backward compat */
export async function humanizeHtmlLegacy(html: string): Promise<string> {
  const result = await humanizeHtml({ html, siteId: '_legacy', mode: 'simple' });
  return result.humanizedHtml;
}
