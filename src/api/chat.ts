import { Router } from 'express';
import { getStorage } from '../storage/filesystem.js';
import { proposeChanges } from '../ai/chat.js';
import { validateChanges, mergeValidatedSlots } from '../guardian/validate.js';
import { renderPage } from '../content/render.js';
import { requireSiteAccess } from '../auth/middleware.js';
import { routeParam } from '../util/params.js';

const router = Router();

const siteAuth = requireSiteAccess(async (siteId) => {
  const storage = await getStorage();
  const site = await storage.getSite(siteId);
  return site?.meta.clientPasswordHash;
});

/** Turn plain-English request into Guardian-validated slot changes */
router.post('/sites/:siteId/pages/:pageId/chat', siteAuth, async (req, res) => {
  try {
    const { message } = req.body as { message?: string };
    if (!message?.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const storage = await getStorage();
    const page = await storage.getPage(routeParam(req.params.siteId), routeParam(req.params.pageId));
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const proposal = await proposeChanges({
      message: message.trim(),
      content: page.content,
      pageTitle: page.title,
    });

    const guardian = validateChanges(page.content, proposal.changes);
    if (!guardian.ok) {
      res.status(422).json({
        error: 'Guardian rejected AI proposal',
        explanation: proposal.explanation,
        provider: proposal.provider,
        guardianErrors: guardian.errors,
        proposedChanges: proposal.changes,
      });
      return;
    }

    const updatedContent = mergeValidatedSlots(page.content, guardian.applied!);
    const saved = await storage.upsertPage(routeParam(req.params.siteId), {
      ...page,
      content: updatedContent,
    });

    res.json({
      ok: true,
      explanation: proposal.explanation,
      provider: proposal.provider,
      changes: proposal.changes,
      page: saved,
      html: renderPage(updatedContent),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Chat failed' });
  }
});

/** Preview AI proposal without applying */
router.post('/sites/:siteId/pages/:pageId/chat/preview', siteAuth, async (req, res) => {
  try {
    const { message } = req.body as { message?: string };
    if (!message?.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const storage = await getStorage();
    const page = await storage.getPage(routeParam(req.params.siteId), routeParam(req.params.pageId));
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const proposal = await proposeChanges({
      message: message.trim(),
      content: page.content,
      pageTitle: page.title,
    });

    const guardian = validateChanges(page.content, proposal.changes);

    res.json({
      explanation: proposal.explanation,
      provider: proposal.provider,
      changes: proposal.changes,
      guardian,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Chat preview failed' });
  }
});

export default router;
