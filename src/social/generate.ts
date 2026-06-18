import { nanoid } from 'nanoid';
import type { BlogPost } from '../content/silo-types.js';
import type { SocialAccount, SocialGenerationBatch, SocialPlatform, SocialVariant } from '../content/social-types.js';
import { PLATFORM_LIMITS } from '../content/social-types.js';
import { resolveAiKeys } from '../integrations/resolve.js';
import { getStyleGuideStore } from '../storage/style-guides.js';
import { getStorage } from '../storage/filesystem.js';
import { generateTextCardsForSite } from './text-card.js';
import {
  buildGenerationMetaUpdate,
  extractBlogSections,
  extractHeroImageUrl,
  pickNextSection,
} from './sections.js';

const PLATFORM_RULES: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn: max 3000 chars, 3-5 hashtags, short paragraphs, hook first line',
  x: 'X/Twitter: max 280 chars, 1-2 hashtags, punchy single post',
  instagram: 'Instagram: max 2200 chars, 5-10 hashtags suggested, emoji sparingly, CTA last line',
  facebook: 'Facebook: conversational tone, optional hashtags, warn if over 500 chars',
};

export interface GenerateOptions {
  siteId: string;
  post: BlogPost;
  accounts: SocialAccount[];
  includeFullScreenCards?: boolean;
  siteDomain?: string;
}

export interface GenerateResult {
  batch: Omit<SocialGenerationBatch, 'id' | 'createdAt' | 'status'>;
  updatedMeta: BlogPost['socialGenerationMeta'];
  overlapWarning?: { run: number };
}

async function callAi(prompt: string): Promise<string> {
  const ai = await resolveAiKeys();
  if (!ai) throw new Error('Configure AI keys in Admin → Integrations first');

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
            messages: [{ role: 'user', content: prompt }],
          }),
        })
      : await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${ai.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ai.model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          }),
        });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI generation failed: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return ai.provider === 'anthropic'
    ? ((data as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '{}')
    : ((data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ??
        '{}');
}

export async function generateSocialBatch(opts: GenerateOptions): Promise<GenerateResult> {
  const { siteId, post, accounts } = opts;
  const included = accounts.filter((a) => a.included);
  if (included.length === 0) {
    throw new Error('No included social accounts configured');
  }

  const sections = extractBlogSections(post.bodyHtml);
  const { section, overlap, overlapRun } = pickNextSection(sections, post.socialGenerationMeta);
  const generationRun = (post.socialGenerationMeta?.runCount ?? 0) + 1;
  const targetKeywords = [post.keyword, section.heading].filter(Boolean);

  const outline = sections
    .map((s) => `- ${s.heading}: ${s.excerpt.slice(0, 120)}`)
    .join('\n');

  const usedList = (post.socialGenerationMeta?.usedSections ?? []).join(', ') || 'none';
  const platforms = included.map((a) => a.platform);

  const prompt = `Generate social media post variants for a blog article.

Blog title: ${post.title}
Pillar keyword: ${post.keyword}
Target section for this run: "${section.heading}" — ${section.excerpt}
Blog outline:
${outline}

Previously used sections: ${usedList}
Generation run #${generationRun}

Platforms needed: ${platforms.join(', ')}

For EACH platform, create exactly 2 distinct variants (variantIndex 1 and 2).
Return JSON only:
{
  "variants": [
    {
      "platform": "linkedin|x|instagram|facebook",
      "variantIndex": 1,
      "bodyText": "plain text caption without hashtags",
      "suggestedTags": ["tag1", "tag2"]
    }
  ]
}

Rules per platform:
${platforms.map((p) => PLATFORM_RULES[p]).join('\n')}

Do NOT include hashtags in bodyText. Keep within character limits.`;

  const raw = await callAi(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI returned invalid JSON');

  const parsed = JSON.parse(match[0]) as {
    variants: Array<{
      platform: SocialPlatform;
      variantIndex: 1 | 2;
      bodyText: string;
      suggestedTags: string[];
    }>;
  };

  const heroUrl = extractHeroImageUrl(post.bodyHtml);
  let textCards: { textCardLight?: string; textCardDark?: string } = {};

  if (opts.includeFullScreenCards !== false) {
    const styleStore = await getStyleGuideStore();
    const styleGuide = await styleStore.get(siteId);
    const storage = await getStorage();
    const publicDir = storage.getSitePublicDir(siteId);
    textCards = await generateTextCardsForSite(
      siteId,
      publicDir,
      section.heading.slice(0, 120) || post.title.slice(0, 120),
      post.keyword,
      styleGuide
    );
  }

  const variants: SocialVariant[] = [];
  for (const row of parsed.variants ?? []) {
    if (!platforms.includes(row.platform)) continue;
    const limits = PLATFORM_LIMITS[row.platform];
    let bodyText = row.bodyText.trim();
    if (bodyText.length > limits.maxChars) {
      bodyText = bodyText.slice(0, limits.maxChars - 3) + '...';
    }

    variants.push({
      id: nanoid(10),
      platform: row.platform,
      variantIndex: row.variantIndex === 2 ? 2 : 1,
      bodyText,
      suggestedTags: (row.suggestedTags ?? []).slice(0, limits.maxTags),
      images: {
        ...(heroUrl ? { hero: { url: heroUrl } } : {}),
        ...(textCards.textCardLight ? { textCardLight: { url: textCards.textCardLight } } : {}),
        ...(textCards.textCardDark ? { textCardDark: { url: textCards.textCardDark } } : {}),
      },
    });
  }

  // Ensure 2 variants per included platform
  for (const account of included) {
    const existing = variants.filter((v) => v.platform === account.platform);
    while (existing.length < 2) {
      const idx = (existing.length + 1) as 1 | 2;
      const fallback: SocialVariant = {
        id: nanoid(10),
        platform: account.platform,
        variantIndex: idx,
        bodyText: `${post.title}\n\n${section.excerpt}`.slice(0, PLATFORM_LIMITS[account.platform].maxChars),
        suggestedTags: [post.keyword.replace(/\s+/g, '')].filter(Boolean),
        images: variants[0]?.images ?? {},
      };
      variants.push(fallback);
      existing.push(fallback);
    }
  }

  const batch: Omit<SocialGenerationBatch, 'id' | 'createdAt' | 'status'> = {
    siteId,
    sourcePostId: post.id,
    generationRun,
    sourceSection: section.slug,
    targetKeywords,
    variants,
  };

  return {
    batch,
    updatedMeta: buildGenerationMetaUpdate(post, section.slug),
    overlapWarning: overlap && overlapRun ? { run: overlapRun } : undefined,
  };
}
