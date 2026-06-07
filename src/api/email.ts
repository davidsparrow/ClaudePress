import { Router } from 'express';
import { getStorage } from '../storage/filesystem.js';
import { requireOwner, requireSiteAccess } from '../auth/middleware.js';
import {
  sendTestEmail,
  sendClientInvite,
  maskApiKey,
  buildContactFormSnippet,
  buildEditorUrl,
} from '../email/send.js';
import { EmailSettingsSchema, InviteEmailSchema, TestEmailSchema } from '../email/validate.js';
import type { SiteEmailConfig } from '../storage/types.js';
import { routeParam } from '../util/params.js';

const router = Router();
const APP_URL = process.env.APP_URL ?? 'http://localhost:3001';

const siteAuth = requireSiteAccess(async (siteId) => {
  const storage = await getStorage();
  const site = await storage.getSite(siteId);
  return site?.meta.clientPasswordHash;
});

function publicEmailSettings(email?: SiteEmailConfig) {
  if (!email) return { enabled: false };
  return {
    enabled: !!email.enabled,
    fromEmail: email.fromEmail,
    fromName: email.fromName,
    notifyEmail: email.notifyEmail,
    hasApiKey: !!email.resendApiKey,
    apiKeyPreview: maskApiKey(email.resendApiKey),
  };
}

/** Get email settings (masked — owner only) */
router.get('/sites/:siteId/email', requireOwner, async (req, res) => {
  const storage = await getStorage();
  const site = await storage.getSite(routeParam(req.params.siteId));
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  res.json({
    settings: publicEmailSettings(site.meta.email),
    editorUrl: buildEditorUrl(site.meta.id, APP_URL),
    contactFormSnippet: buildContactFormSnippet(site.meta.id, APP_URL),
  });
});

/** Save Resend settings (owner only — BYOK) */
router.put('/sites/:siteId/email', requireOwner, async (req, res) => {
  try {
    const parsed = EmailSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors.map((e) => e.message).join(', ') });
      return;
    }

    const storage = await getStorage();
    const site = await storage.getSite(routeParam(req.params.siteId));
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    const current = site.meta.email ?? {};
    const next: SiteEmailConfig = {
      ...current,
      ...(parsed.data.fromEmail !== undefined ? { fromEmail: parsed.data.fromEmail } : {}),
      ...(parsed.data.fromName !== undefined ? { fromName: parsed.data.fromName } : {}),
      ...(parsed.data.notifyEmail !== undefined ? { notifyEmail: parsed.data.notifyEmail } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
    };

    if (parsed.data.resendApiKey?.trim()) {
      next.resendApiKey = parsed.data.resendApiKey.trim();
    }

    const meta = await storage.updateSiteMeta(routeParam(req.params.siteId), { email: next });
    res.json({ settings: publicEmailSettings(meta.email) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save email settings' });
  }
});

/** Send test email */
router.post('/sites/:siteId/email/test', requireOwner, async (req, res) => {
  try {
    const parsed = TestEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid "to" email is required' });
      return;
    }

    const storage = await getStorage();
    const site = await storage.getSite(routeParam(req.params.siteId));
    if (!site?.meta.email) {
      res.status(400).json({ error: 'Configure email settings first' });
      return;
    }

    const result = await sendTestEmail(site.meta.email, site.meta.name, parsed.data.to);
    if (result.error) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json({ ok: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Test send failed' });
  }
});

/** Email client their editor link */
router.post('/sites/:siteId/email/invite', requireOwner, async (req, res) => {
  try {
    const parsed = InviteEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid client "to" email is required' });
      return;
    }

    const storage = await getStorage();
    const site = await storage.getSite(routeParam(req.params.siteId));
    if (!site?.meta.email) {
      res.status(400).json({ error: 'Configure email settings first' });
      return;
    }

    const result = await sendClientInvite(site.meta.email, {
      siteName: site.meta.name,
      editorUrl: buildEditorUrl(site.meta.id, APP_URL),
      to: parsed.data.to,
      agencyName: parsed.data.agencyName,
    });

    if (result.error) {
      res.status(502).json({ error: result.error });
      return;
    }
    res.json({ ok: true, id: result.id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Invite send failed' });
  }
});

/** List stored form submissions */
router.get('/sites/:siteId/submissions', siteAuth, async (req, res) => {
  const storage = await getStorage();
  const site = await storage.getSite(routeParam(req.params.siteId));
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const submissions = await storage.listSubmissions(routeParam(req.params.siteId));
  res.json(submissions);
});

export default router;
