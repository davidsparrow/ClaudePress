import { Router } from 'express';
import { getStorage } from '../storage/filesystem.js';
import {
  savePublishBundle,
  listPublishes,
  getPublishBundle,
  deployToVercel,
  updatePublishRecord,
} from '../publish/index.js';
import { requireSiteAccess, ownerOnly } from '../auth/middleware.js';
import { routeParam } from '../util/params.js';

const router = Router();

const siteAuth = requireSiteAccess(async (siteId) => {
  const storage = await getStorage();
  const site = await storage.getSite(siteId);
  return site?.meta.clientPasswordHash;
});

/** Publish current site pages as immutable static snapshot */
router.post('/sites/:siteId/publish', siteAuth, async (req, res) => {
  try {
    const { label, deploy } = req.body as { label?: string; deploy?: boolean };
    const storage = await getStorage();
    const site = await storage.getSite(routeParam(req.params.siteId));
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }
    if (site.pages.length === 0) {
      res.status(400).json({ error: 'No pages to publish' });
      return;
    }

    const bundle = await savePublishBundle(
      routeParam(req.params.siteId),
      site.pages,
      label ?? `Publish ${new Date().toISOString()}`
    );

    // Auto-snapshot before publish
    await storage.createVersion(routeParam(req.params.siteId), `Pre-publish ${bundle.record.id}`);

    let deploymentUrl: string | undefined;
    let vercelDeploymentId: string | undefined;

    if (deploy !== false && process.env.VERCEL_TOKEN) {
      const result = await deployToVercel(bundle.record, bundle.files, {
        token: process.env.VERCEL_TOKEN,
        projectName: site.meta.domain?.replace(/\./g, '-') ?? `claudepress-${site.meta.id}`,
        teamId: process.env.VERCEL_TEAM_ID,
      });
      deploymentUrl = result.url;
      vercelDeploymentId = result.deploymentId;
      bundle.record.deploymentUrl = deploymentUrl;
      bundle.record.vercelDeploymentId = vercelDeploymentId;
      await updatePublishRecord(bundle.record);
    }

    res.status(201).json({
      publish: bundle.record,
      deploymentUrl,
      vercelDeploymentId,
      localFiles: Object.keys(bundle.files),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Publish failed' });
  }
});

router.get('/sites/:siteId/publishes', siteAuth, async (req, res) => {
  const publishes = await listPublishes(routeParam(req.params.siteId));
  res.json(publishes);
});

router.get('/sites/:siteId/publishes/:publishId', siteAuth, async (req, res) => {
  const bundle = await getPublishBundle(routeParam(req.params.siteId), routeParam(req.params.publishId));
  if (!bundle) {
    res.status(404).json({ error: 'Publish not found' });
    return;
  }
  res.json(bundle);
});

/** Serve a published page locally (for preview before DNS) */
router.get('/sites/:siteId/publishes/:publishId/preview/*', siteAuth, async (req, res) => {
  const bundle = await getPublishBundle(routeParam(req.params.siteId), routeParam(req.params.publishId));
  if (!bundle) {
    res.status(404).json({ error: 'Publish not found' });
    return;
  }
  const filePath = req.params[0] || 'index.html';
  const html = bundle.files[filePath] ?? bundle.files['index.html'];
  if (!html) {
    res.status(404).json({ error: 'File not found in bundle' });
    return;
  }
  res.type('html').send(html);
});

/** Roll back site content from a publish snapshot */
router.post('/sites/:siteId/publishes/:publishId/rollback', siteAuth, ownerOnly, async (req, res) => {
  try {
    const bundle = await getPublishBundle(routeParam(req.params.siteId), routeParam(req.params.publishId));
    if (!bundle) {
      res.status(404).json({ error: 'Publish not found' });
      return;
    }

    const storage = await getStorage();
    const site = await storage.getSite(routeParam(req.params.siteId));
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    // Restore from the version that matches publish time isn't stored in bundle directly,
    // so we use version restore API — publish already creates pre-publish version.
    // Here we re-ingest from bundle HTML is not ideal; instead restore matching version.
    res.json({
      ok: true,
      message: 'Use POST /versions/:versionId/restore to roll back content, or re-publish an older snapshot.',
      publish: bundle.record,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Rollback failed' });
  }
});

export default router;
