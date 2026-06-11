import { Router } from 'express';
import { nanoid } from 'nanoid';
import { requireOwner, requireSiteAccess } from '../auth/middleware.js';
import { routeParam } from '../util/params.js';
import { getCampaignStore } from '../storage/campaigns.js';
import { getBlogSiloStore } from '../storage/blog-silo.js';
import { resolveAiKeys } from '../integrations/resolve.js';
import type { CampaignStep } from '../content/campaign-types.js';

const router = Router();

const siteAuth = requireSiteAccess(async (siteId) => {
  const { getStorage } = await import('../storage/filesystem.js');
  const storage = await getStorage();
  const site = await storage.getSite(siteId);
  return site?.meta.clientPasswordHash;
});

router.get('/sites/:siteId/campaigns', siteAuth, async (req, res) => {
  const store = await getCampaignStore();
  res.json(await store.listCampaigns(routeParam(req.params.siteId)));
});

router.post('/sites/:siteId/campaigns', requireOwner, async (req, res) => {
  try {
    const siteId = routeParam(req.params.siteId);
    const { pillarId } = req.body as { pillarId?: string };
    if (!pillarId) {
      res.status(400).json({ error: 'pillarId is required' });
      return;
    }

    const blog = await getBlogSiloStore();
    const pillar = await blog.getPillar(siteId, pillarId);
    if (!pillar) {
      res.status(404).json({ error: 'Pillar not found' });
      return;
    }

    const posts = await blog.listPosts(siteId, pillarId);
    const published = posts.filter((p) => p.status === 'published' || p.bodyHtml.length > 20);

    const ai = await resolveAiKeys();
    let steps: CampaignStep[] = [];

    if (ai && published.length > 0) {
      const contentSummary = published
        .map((p) => `## ${p.title}\n${p.bodyHtml.replace(/<[^>]+>/g, ' ').slice(0, 500)}`)
        .join('\n\n');

      const prompt = `Generate a ${Math.min(5, published.length)}-email nurture sequence JSON array for keyword "${pillar.keyword}". Each item: subject, preview_text, body_html (simple HTML), delay_days. Email 1 from pillar content, then supportive posts, last email soft CTA. Return ONLY JSON array.`;

      const aiRes =
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
                messages: [{ role: 'user', content: `${prompt}\n\n${contentSummary}` }],
              }),
            })
          : await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${ai.apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: ai.model,
                messages: [{ role: 'user', content: `${prompt}\n\n${contentSummary}` }],
                response_format: { type: 'json_object' },
              }),
            });

      if (aiRes.ok) {
        const data = await aiRes.json();
        let text =
          ai.provider === 'anthropic'
            ? (data as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '[]'
            : (data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message
                ?.content ?? '[]';
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]) as Array<{
            subject: string;
            preview_text: string;
            body_html: string;
            delay_days: number;
          }>;
          const now = new Date().toISOString();
          steps = parsed.map((row, i) => ({
            id: nanoid(10),
            campaignId: '',
            siteId,
            order: i,
            subject: row.subject,
            previewText: row.preview_text,
            bodyHtml: row.body_html,
            delayDays: row.delay_days ?? (i === 0 ? 0 : 2 + i),
            sourcePostId: published[i]?.id,
            createdAt: now,
            updatedAt: now,
          }));
        }
      }
    }

    if (steps.length === 0) {
      const now = new Date().toISOString();
      steps = published.slice(0, 3).map((p, i) => ({
        id: nanoid(10),
        campaignId: '',
        siteId,
        order: i,
        subject: p.title,
        previewText: p.metaDescription ?? '',
        bodyHtml: `<p>${p.title}</p>${p.bodyHtml.slice(0, 400)}`,
        delayDays: i === 0 ? 0 : 2 * i,
        sourcePostId: p.id,
        createdAt: now,
        updatedAt: now,
      }));
    }

    const campStore = await getCampaignStore();
    const campaign = await campStore.createCampaign(siteId, {
      pillarId,
      keyword: pillar.keyword,
      name: `${pillar.title} — Lead Nurture`,
    });

    steps = steps.map((s) => ({ ...s, campaignId: campaign.id }));
    await campStore.saveSteps(siteId, campaign.id, steps);

    res.status(201).json({ campaign, steps });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Create campaign failed' });
  }
});

router.get('/sites/:siteId/campaigns/:campaignId', siteAuth, async (req, res) => {
  const siteId = routeParam(req.params.siteId);
  const campaignId = routeParam(req.params.campaignId);
  const store = await getCampaignStore();
  const campaign = await store.getCampaign(siteId, campaignId);
  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }
  const steps = await store.listSteps(siteId, campaignId);
  res.json({ campaign, steps });
});

router.post('/sites/:siteId/campaigns/:campaignId/activate', requireOwner, async (req, res) => {
  try {
    const siteId = routeParam(req.params.siteId);
    const campaignId = routeParam(req.params.campaignId);
    const store = await getCampaignStore();
    const campaign = await store.getCampaign(siteId, campaignId);
    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    const steps = await store.listSteps(siteId, campaignId);
    const { getStorage } = await import('../storage/filesystem.js');
    const storage = await getStorage();
    const site = await storage.getSite(siteId);
    const resendKey = site?.meta.email?.resendApiKey;

    if (!resendKey) {
      res.status(400).json({ error: 'Configure Resend API key in Site Settings → Email first' });
      return;
    }

    // Resend Automations API — structure per campaign spec; verify endpoints at deploy time
    const automationPayload = {
      name: campaign.name,
      status: 'enabled',
      trigger: { event: 'lead.subscribed', filter: { pillar_keyword: campaign.keyword } },
      steps: steps.map((s, i) => ({
        type: 'send_email',
        order: i,
        subject: s.subject,
        html: s.bodyHtml,
        delay_days: s.delayDays,
      })),
    };

    const resendRes = await fetch('https://api.resend.com/automations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(automationPayload),
    });

    let automationId: string | undefined;
    if (resendRes.ok) {
      const data = (await resendRes.json()) as { id?: string };
      automationId = data.id;
    }

    campaign.status = 'active';
    campaign.activatedAt = new Date().toISOString();
    campaign.resendAutomationId = automationId ?? `pending-${campaign.id}`;
    await store.saveCampaign(campaign);

    res.json({
      campaign,
      automationId: campaign.resendAutomationId,
      resendStatus: resendRes.ok ? 'created' : 'stubbed',
      note: resendRes.ok ? undefined : 'Resend Automations API returned non-OK; campaign marked active locally for review.',
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Activate failed' });
  }
});

export default router;
