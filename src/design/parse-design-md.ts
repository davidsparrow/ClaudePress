import { buildDefaultStyleGuide, generateCssVariables, StyleGuideSchema, type StyleGuide } from './style-guide.js';
import { resolveAiKeys } from '../integrations/resolve.js';

const HEX_RE = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
const FONT_RE = /(?:font(?:-family)?[:\s]+|Font[:\s]+)["']?([A-Za-z0-9 ,-]+)/gi;

function extractHexColors(raw: string): string[] {
  const matches = raw.match(HEX_RE) ?? [];
  return [...new Set(matches.map((h) => h.toLowerCase()))];
}

function extractFonts(raw: string): string[] {
  const fonts: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(FONT_RE.source, 'gi');
  while ((m = re.exec(raw)) !== null) {
    const name = m[1].split(',')[0].trim().replace(/['"]/g, '');
    if (name.length > 2 && !fonts.includes(name)) fonts.push(name);
  }
  return fonts;
}

/** Heuristic parser — no AI required */
export function parseDesignMdHeuristic(
  rawMd: string,
  themeId: string,
  themeName: string,
  aesthetic: string
): StyleGuide {
  const guide = buildDefaultStyleGuide(themeId, themeName, aesthetic);
  const colors = extractHexColors(rawMd);
  const fonts = extractFonts(rawMd);

  if (colors[0]) guide.colors.primary = colors[0];
  if (colors[1]) guide.colors.secondary = colors[1];
  if (colors[2]) guide.colors.accent = colors[2];
  if (colors[3]) guide.colors.background = colors[3];
  if (colors[4]) guide.colors.surface = colors[4];
  if (colors[5]) guide.colors.text = colors[5];

  if (fonts[0]) guide.typography.headingFont = fonts[0];
  if (fonts[1]) guide.typography.bodyFont = fonts[1];
  else if (fonts[0]) guide.typography.bodyFont = fonts[0];

  if (rawMd.toLowerCase().includes('dark')) {
    guide.colors.background = guide.colors.background === '#ffffff' ? '#0a0a0a' : guide.colors.background;
    guide.colors.text = '#f5f5f5';
    guide.colors.surface = '#1a1a1a';
  }

  guide.aiSystemPromptAddition = `Design direction: ${themeName} (${aesthetic}). Primary ${guide.colors.primary}, accent ${guide.colors.accent}. Fonts: ${guide.typography.headingFont} headings, ${guide.typography.bodyFont} body.`;
  guide.cssVariables = generateCssVariables(guide);
  return StyleGuideSchema.parse(guide);
}

export async function parseDesignMd(
  rawMd: string,
  themeId: string,
  themeName: string,
  aesthetic: string
): Promise<StyleGuide> {
  const heuristic = parseDesignMdHeuristic(rawMd, themeId, themeName, aesthetic);
  const ai = await resolveAiKeys();
  if (!ai) return heuristic;

  try {
    const systemPrompt = `You are a design system parser. Given DESIGN.md content, return ONLY valid JSON matching this schema fields: meta (keep id/name/source/sourceRef/aesthetic/designPhilosophy/createdAt), colors, typography, spacing, radii, shadows, components, motion, aiSystemPromptAddition, tailwindExtension (object), cssVariables (string). Use hex colors. Fill all fields.`;
    const userContent = `Theme: ${themeName}\n\n${rawMd.slice(0, 12000)}`;

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
              system: systemPrompt,
              messages: [{ role: 'user', content: userContent }],
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
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
              ],
              response_format: { type: 'json_object' },
            }),
          });

    if (!res.ok) return heuristic;

    const data = await res.json();
    let text = '';
    if (ai.provider === 'anthropic') {
      text = (data as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '';
    } else {
      text = (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? '';
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return heuristic;

    const parsed = JSON.parse(jsonMatch[0]) as StyleGuide;
    parsed.meta = {
      ...heuristic.meta,
      ...parsed.meta,
      id: heuristic.meta.id,
      source: 'awesome-design-md',
      sourceRef: themeId,
      createdAt: heuristic.meta.createdAt,
    };
    if (!parsed.cssVariables) parsed.cssVariables = generateCssVariables(parsed);
    return StyleGuideSchema.parse(parsed);
  } catch {
    return heuristic;
  }
}
