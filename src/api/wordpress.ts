import { Router } from 'express';
import { getStorage } from '../storage/filesystem.js';
import { requireOwner } from '../auth/middleware.js';
import { buildWordPressTheme } from '../wordpress/export.js';
import { createThemeZip } from '../wordpress/zip.js';
import { routeParam } from '../util/params.js';

const router = Router();

/** Download site as WordPress theme ZIP */
router.get('/sites/:siteId/wordpress/download', requireOwner, async (req, res) => {
  try {
    const storage = await getStorage();
    const site = await storage.getSite(routeParam(req.params.siteId));
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }
    if (site.pages.length === 0) {
      res.status(400).json({ error: 'No pages to export — ingest at least one page first' });
      return;
    }

    const theme = buildWordPressTheme(site);
    const zip = await createThemeZip(theme);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${theme.themeSlug}-wordpress-theme.zip"`
    );
    res.send(zip);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Export failed' });
  }
});

/** Preview export metadata without downloading */
router.get('/sites/:siteId/wordpress', requireOwner, async (req, res) => {
  try {
    const storage = await getStorage();
    const site = await storage.getSite(routeParam(req.params.siteId));
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    const theme = buildWordPressTheme(site);
    res.json({
      themeSlug: theme.themeSlug,
      themeName: theme.themeName,
      pageCount: site.pages.length,
      slotCount: Object.keys(JSON.parse(theme.files['inc/slots.json'])).length,
      files: Object.keys(theme.files),
      includes: ['INSTALL.md', 'ANIMATIONS.md', 'inc/slots.json', 'PHP page templates'],
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Preview failed' });
  }
});

export default router;
