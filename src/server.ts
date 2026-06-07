import express from 'express';
import cors from 'cors';
import { ingestUrl, ingestHtml } from './ingest/index.js';
import { renderPage } from './content/render.js';
import { validateChanges, mergeValidatedSlots } from './guardian/validate.js';
import type { PageContent, SlotChange } from './content/types.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

/** Ingest a live URL into frozen template + slots */
app.post('/api/ingest', async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url) {
      res.status(400).json({ error: 'url is required' });
      return;
    }
    const result = await ingestUrl(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Ingest failed' });
  }
});

/** Ingest raw HTML (for testing or pasted content) */
app.post('/api/ingest/html', (req, res) => {
  try {
    const { sourceUrl, html } = req.body as { sourceUrl?: string; html?: string };
    if (!html) {
      res.status(400).json({ error: 'html is required' });
      return;
    }
    const result = ingestHtml(sourceUrl ?? 'https://example.com/', html);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Ingest failed' });
  }
});

/** Preview rendered HTML from template + slots */
app.post('/api/render', (req, res) => {
  try {
    const content = req.body as PageContent;
    if (!content?.template || !content?.slots) {
      res.status(400).json({ error: 'template and slots are required' });
      return;
    }
    const html = renderPage(content);
    res.type('html').send(html);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Render failed' });
  }
});

/** Validate and apply slot changes through the Guardian */
app.post('/api/guardian/validate', (req, res) => {
  try {
    const { content, changes } = req.body as {
      content?: PageContent;
      changes?: SlotChange[];
    };
    if (!content || !changes) {
      res.status(400).json({ error: 'content and changes are required' });
      return;
    }
    const result = validateChanges(content, changes);
    if (!result.ok) {
      res.status(422).json(result);
      return;
    }
    const updated = mergeValidatedSlots(content, result.applied!);
    res.json({ ok: true, content: updated, html: renderPage(updated) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Validation failed' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`ClaudePress API listening on http://localhost:${PORT}`);
  });
}

export default app;
