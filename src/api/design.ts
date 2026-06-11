import { Router } from 'express';
import { requireOwner, requireSiteAccess } from '../auth/middleware.js';
import { routeParam } from '../util/params.js';
import { getStorage } from '../storage/filesystem.js';
import { getStyleGuideStore } from '../storage/style-guides.js';
import { listThemes, getDesignMdCached } from '../design/awesome-design-md.js';
import { parseDesignMd } from '../design/parse-design-md.js';

const router = Router();

const siteAuth = requireSiteAccess(async (siteId) => {
  const storage = await getStorage();
  const site = await storage.getSite(siteId);
  return site?.meta.clientPasswordHash;
});

router.get('/design/themes', requireOwner, (_req, res) => {
  res.json({ themes: listThemes() });
});

router.get('/sites/:siteId/design/preview/:themeId', requireOwner, async (req, res) => {
  try {
    const themeId = routeParam(req.params.themeId);
    const theme = listThemes().find((t) => t.id === themeId);
    if (!theme) {
      res.status(404).json({ error: 'Theme not found' });
      return;
    }

    let rawMd = '';
    try {
      rawMd = await getDesignMdCached(themeId);
    } catch {
      rawMd = `# ${theme.name}\n${theme.desc}`;
    }

    const guide = await parseDesignMd(rawMd, themeId, theme.name, theme.aesthetic);
    res.json({ styleGuide: guide });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Preview failed' });
  }
});

router.post('/sites/:siteId/design/apply', requireOwner, async (req, res) => {
  try {
    const siteId = routeParam(req.params.siteId);
    const { themeId } = req.body as { themeId?: string };
    if (!themeId) {
      res.status(400).json({ error: 'themeId is required' });
      return;
    }

    const storage = await getStorage();
    const site = await storage.getSite(siteId);
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    const theme = listThemes().find((t) => t.id === themeId);
    if (!theme) {
      res.status(404).json({ error: 'Theme not found' });
      return;
    }

    let rawMd = '';
    try {
      rawMd = await getDesignMdCached(themeId);
    } catch {
      rawMd = `# ${theme.name}\n${theme.desc}`;
    }

    const guide = await parseDesignMd(rawMd, themeId, theme.name, theme.aesthetic);
    const store = await getStyleGuideStore();
    await store.save(siteId, guide);
    await storage.updateSiteMeta(siteId, { styleGuideId: guide.meta.id });

    res.json({ styleGuide: guide });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Apply failed' });
  }
});

router.get('/sites/:siteId/design', siteAuth, async (req, res) => {
  const siteId = routeParam(req.params.siteId);
  const store = await getStyleGuideStore();
  const guide = await store.get(siteId);
  if (!guide) {
    res.status(404).json({ error: 'No style guide for this site' });
    return;
  }
  res.json({ styleGuide: guide });
});

export default router;
