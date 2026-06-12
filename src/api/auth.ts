import { Router } from 'express';
import { requireAdmin, extractBearer, hashPassword, verifyPassword } from '../auth/middleware.js';
import { getWorkspaceUsersStore, hashSessionToken } from '../storage/workspace-users.js';
import type { AuthMeResponse } from '../auth/types.js';

const router = Router();
const MASTER_KEY = process.env.MASTER_KEY ?? '';

/** Email + password login; returns session token */
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email?.trim() || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const store = await getWorkspaceUsersStore();
    const user = await store.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const workspace = await store.getWorkspace();
    if (!workspace || workspace.id !== user.workspaceId) {
      res.status(500).json({ error: 'Workspace not found' });
      return;
    }

    const { token } = await store.createSession(user.id, workspace.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        planTier: workspace.planTier,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Login failed' });
  }
});

/** Bootstrap workspace + owner on first MASTER_KEY login */
router.post('/auth/bootstrap', async (req, res) => {
  try {
    const { masterKey, email, password, displayName, workspaceName } = req.body as {
      masterKey?: string;
      email?: string;
      password?: string;
      displayName?: string;
      workspaceName?: string;
    };

    if (!MASTER_KEY) {
      res.status(503).json({ error: 'MASTER_KEY not configured on server' });
      return;
    }
    if (!masterKey || masterKey !== MASTER_KEY) {
      res.status(401).json({ error: 'Invalid master key' });
      return;
    }

    const store = await getWorkspaceUsersStore();
    const existing = await store.getWorkspace();
    if (existing) {
      res.status(409).json({ error: 'Workspace already exists', workspace: existing });
      return;
    }

    if (!email?.trim() || !password || !displayName?.trim()) {
      res.status(400).json({ error: 'email, password, and displayName are required for bootstrap' });
      return;
    }

    const workspace = await store.createWorkspace(workspaceName?.trim() || 'My Agency');
    const user = await store.createUser({
      workspaceId: workspace.id,
      email: email.trim(),
      passwordHash: hashPassword(password),
      displayName: displayName.trim(),
      role: 'owner',
    });

    const { token } = await store.createSession(user.id, workspace.id);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        planTier: workspace.planTier,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Bootstrap failed' });
  }
});

/** Current auth context */
router.get('/auth/me', async (req, res) => {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const store = await getWorkspaceUsersStore();

  // Session token
  const session = await store.getSession(hashSessionToken(token));
  if (session && new Date(session.expiresAt) > new Date()) {
    const user = await store.getUserById(session.userId);
    const workspace = await store.getWorkspace();
    if (user && workspace) {
      const body: AuthMeResponse = {
        role: 'admin',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          preferences: user.preferences,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
          planTier: workspace.planTier,
        },
      };
      res.json(body);
      return;
    }
  }

  // Master key break-glass
  if (MASTER_KEY && token === MASTER_KEY) {
    const workspace = await store.getWorkspace();
    const body: AuthMeResponse = {
      role: 'admin',
      workspace: workspace
        ? { id: workspace.id, name: workspace.name, planTier: workspace.planTier }
        : undefined,
    };
    res.json(body);
    return;
  }

  res.status(401).json({ error: 'Invalid or expired session' });
});

router.post('/auth/logout', async (req, res) => {
  const token = extractBearer(req);
  if (token && token !== MASTER_KEY) {
    const store = await getWorkspaceUsersStore();
    await store.deleteSession(hashSessionToken(token));
  }
  res.json({ ok: true });
});

/** Update current user preferences */
router.patch('/auth/me/preferences', requireAdmin, async (req, res) => {
  try {
    if (!req.auth?.userId) {
      res.status(400).json({ error: 'Session required — master key cannot update preferences' });
      return;
    }
    const store = await getWorkspaceUsersStore();
    const prefs = req.body as { defaultHumanizerMode?: 'simple' | 'skill'; lastSiteId?: string };
    const user = await store.updateUserPreferences(req.auth.userId, prefs);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ preferences: user.preferences });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Update failed' });
  }
});

export default router;
