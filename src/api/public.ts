import { Router } from 'express';
import { getStorage } from '../storage/filesystem.js';
import { ContactFormSchema } from '../email/validate.js';
import { sendContactNotification } from '../email/send.js';
import { routeParam } from '../util/params.js';

const router = Router();

/** Public contact form endpoint for published client sites */
router.post('/public/sites/:siteId/contact', async (req, res) => {
  try {
    const parsed = ContactFormSchema.safeParse({
      name: req.body.name,
      email: req.body.email,
      message: req.body.message,
      pagePath: req.body.pagePath ?? req.body.page,
    });

    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid form data', details: parsed.error.flatten() });
      return;
    }

    const storage = await getStorage();
    const site = await storage.getSite(routeParam(req.params.siteId));
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    if (!site.meta.email?.enabled) {
      res.status(503).json({ error: 'Contact form is not enabled for this site' });
      return;
    }

    const submission = await storage.addSubmission(routeParam(req.params.siteId), parsed.data);
    const sendResult = await sendContactNotification(site.meta.email, site.meta.name, submission);

    if (sendResult?.error) {
      res.status(502).json({
        ok: true,
        stored: true,
        warning: `Submission saved but email failed: ${sendResult.error}`,
        submissionId: submission.id,
      });
      return;
    }

    res.status(201).json({ ok: true, submissionId: submission.id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Submission failed' });
  }
});

export default router;
