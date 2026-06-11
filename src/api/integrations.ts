import { Router } from 'express';
import { requireOwner } from '../auth/middleware.js';
import { getIntegrationsStore } from '../storage/integrations.js';
import type { WorkspaceIntegrationsUpdate } from '../storage/integrations-types.js';

const router = Router();

router.get('/admin/integrations', requireOwner, async (_req, res) => {
  try {
    const store = await getIntegrationsStore();
    res.json(await store.getStatus());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load integrations' });
  }
});

router.put('/admin/integrations', requireOwner, async (req, res) => {
  try {
    const patch = req.body as WorkspaceIntegrationsUpdate;
    const store = await getIntegrationsStore();
    const status = await store.update(patch);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save integrations' });
  }
});

router.get('/admin/openrouter/models', requireOwner, async (_req, res) => {
  try {
    const store = await getIntegrationsStore();
    const apiKey = (await store.getSecret('openrouter_api_key')) ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      res.status(400).json({ error: 'OpenRouter API key not configured' });
      return;
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      res.status(502).json({ error: `OpenRouter API error: ${response.status}` });
      return;
    }

    const data = (await response.json()) as {
      data?: Array<{ id: string; name?: string }>;
    };
    const models = (data.data ?? []).map((m) => ({ id: m.id, name: m.name ?? m.id }));
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch models' });
  }
});

export default router;
