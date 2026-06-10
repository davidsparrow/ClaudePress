import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getStorage } from '../storage/filesystem.js';
import { ingestUrl } from '../ingest/index.js';
import { renderPage } from '../content/render.js';
import { validateChanges, mergeValidatedSlots } from '../guardian/validate.js';
import {
  requireOwner,
  requireSiteAccess,
  ownerOnly,
  hashPassword,
} from '../auth/middleware.js';
import type { SlotChange } from '../content/types.js';
import type { Site } from '../storage/types.js';
import { routeParam } from '../util/params.js';

function sanitizeSite(site: Site): Site {
  const { clientPasswordHash: _, email, ...metaRest } = site.meta;
  return {
    ...site,
    meta: {
      ...metaRest,
      ...(email
        ? {
            email: {
              enabled: email.enabled,
              fromEmail: email.fromEmail,
              fromName: email.fromName,
              notifyEmail: email.notifyEmail,
            },
          }
        : {}),
    },
  };
}

const router = Router();

const siteAuth = requireSiteAccess(async (siteId) => {
  const storage = await getStorage();
  const site = await storage.getSite(siteId);
  return site?.meta.clientPasswordHash;
});

// ── Sites (owner) ──────────────────────────────────────────────

router.get('/sites', requireOwner, async (_req, res) => {
  const storage = await getStorage();
  const sites = await storage.listSites();
  res.json(sites);
});

router.post('/sites', requireOwner, async (req, res) => {
  try {
    const { name, domain } = req.body as { name?: string; domain?: string };
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const storage = await getStorage();
    const site = await storage.createSite(name, domain);
    res.status(201).json(site);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create site' });
  }
});

router.get('/sites/:siteId', siteAuth, async (req, res) => {
  const storage = await getStorage();
  const site = await storage.getSite(routeParam(req.params.siteId));
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  res.json(sanitizeSite(site));
});

router.patch('/sites/:siteId', requireOwner, async (req, res) => {
  try {
    const storage = await getStorage();
    const meta = await storage.updateSiteMeta(routeParam(req.params.siteId), req.body);
    res.json(meta);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Update failed' });
  }
});

router.delete('/sites/:siteId', requireOwner, async (req, res) => {
  const storage = await getStorage();
  await storage.deleteSite(routeParam(req.params.siteId));
  res.status(204).send();
});

router.post('/sites/:siteId/password', requireOwner, async (req, res) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password) {
      res.status(400).json({ error: 'password is required' });
      return;
    }
    const storage = await getStorage();
    await storage.setClientPassword(routeParam(req.params.siteId), hashPassword(password));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to set password' });
  }
});

// ── Pages ──────────────────────────────────────────────────────

router.get('/sites/:siteId/pages', siteAuth, async (req, res) => {
  const storage = await getStorage();
  const pages = await storage.listPages(routeParam(req.params.siteId));
  res.json(pages);
});

router.get('/sites/:siteId/pages/:pageId', siteAuth, async (req, res) => {
  const storage = await getStorage();
  const page = await storage.getPage(routeParam(req.params.siteId), routeParam(req.params.pageId));
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  res.json(page);
});

router.post('/sites/:siteId/pages/ingest', siteAuth, ownerOnly, async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url) {
      res.status(400).json({ error: 'url is required' });
      return;
    }
    const result = await ingestUrl(url);
    const storage = await getStorage();
    const page = await storage.upsertPage(routeParam(req.params.siteId), {
      id: nanoid(10),
      path: result.pagePath,
      title: result.title,
      sourceUrl: result.sourceUrl,
      content: result.content,
    });
    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Ingest failed' });
  }
});

router.patch('/sites/:siteId/pages/:pageId', siteAuth, async (req, res) => {
  try {
    const { changes } = req.body as { changes?: SlotChange[] };
    if (!changes?.length) {
      res.status(400).json({ error: 'changes array is required' });
      return;
    }
    const storage = await getStorage();
    const page = await storage.getPage(routeParam(req.params.siteId), routeParam(req.params.pageId));
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }

    const result = validateChanges(page.content, changes);
    if (!result.ok) {
      res.status(422).json(result);
      return;
    }

    const updatedContent = mergeValidatedSlots(page.content, result.applied!);
    const saved = await storage.upsertPage(routeParam(req.params.siteId), {
      ...page,
      content: updatedContent,
    });

    res.json({ page: saved, html: renderPage(updatedContent) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Update failed' });
  }
});

router.get('/sites/:siteId/pages/:pageId/preview', siteAuth, async (req, res) => {
  const storage = await getStorage();
  const page = await storage.getPage(routeParam(req.params.siteId), routeParam(req.params.pageId));
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  res.type('html').send(renderPage(page.content));
});

router.delete('/sites/:siteId/pages/:pageId', requireOwner, async (req, res) => {
  const storage = await getStorage();
  await storage.deletePage(routeParam(req.params.siteId), routeParam(req.params.pageId));
  res.status(204).send();
});

// ── Media (read-only — WordPress import assets) ────────────────

router.get('/sites/:siteId/media', siteAuth, async (req, res) => {
  const storage = await getStorage();
  const site = await storage.getSite(routeParam(req.params.siteId));
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const assets = await storage.listMediaAssets(routeParam(req.params.siteId));
  res.json(
    assets.map(({ siteId: _, ...asset }) => ({
      id: asset.id,
      filename: asset.filename,
      publicPath: asset.publicPath,
      relativePath: asset.relativePath,
      mimeType: asset.mimeType,
      sourceUrl: asset.sourceUrl,
      wpPostId: asset.wpPostId,
      createdAt: asset.createdAt,
    }))
  );
});

// ── Versions ───────────────────────────────────────────────────

router.get('/sites/:siteId/versions', siteAuth, async (req, res) => {
  const storage = await getStorage();
  const versions = await storage.listVersions(routeParam(req.params.siteId));
  res.json(versions);
});

router.post('/sites/:siteId/versions', siteAuth, async (req, res) => {
  try {
    const { label } = req.body as { label?: string };
    const storage = await getStorage();
    const version = await storage.createVersion(
      routeParam(req.params.siteId),
      label ?? `Snapshot ${new Date().toISOString()}`
    );
    res.status(201).json(version);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Version create failed' });
  }
});

router.post('/sites/:siteId/versions/:versionId/restore', siteAuth, async (req, res) => {
  try {
    const storage = await getStorage();
    const site = await storage.restoreVersion(routeParam(req.params.siteId), routeParam(req.params.versionId));
    res.json(site);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Restore failed' });
  }
});

export default router;
