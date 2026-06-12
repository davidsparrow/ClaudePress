import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { routeParam } from '../util/params.js';
import { getWorkspaceUsersStore, hashSessionToken } from '../storage/workspace-users.js';
import type { AuthContext, AuthRole } from './types.js';

export type { AuthContext, AuthRole };

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const MASTER_KEY = process.env.MASTER_KEY ?? '';

/** Simple SHA-256 hash for passwords (no native bcrypt dep needed for MVP) */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  const a = Buffer.from(hashPassword(password));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function resolveAdminAuth(token: string): Promise<AuthContext | null> {
  if (MASTER_KEY && safeCompare(token, MASTER_KEY)) {
    const store = await getWorkspaceUsersStore();
    const workspace = await store.getWorkspace();
    return {
      role: 'admin',
      workspaceId: workspace?.id,
      planTier: workspace?.planTier,
    };
  }

  const store = await getWorkspaceUsersStore();
  const session = await store.getSession(hashSessionToken(token));
  if (!session || new Date(session.expiresAt) <= new Date()) return null;

  const user = await store.getUserById(session.userId);
  const workspace = await store.getWorkspace();
  if (!user || !workspace) return null;

  return {
    role: 'admin',
    userId: user.id,
    workspaceId: workspace.id,
    userRole: user.role,
    planTier: workspace.planTier,
  };
}

/** Require admin session or master key */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    const token = extractBearer(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const auth = await resolveAdminAuth(token);
    if (!auth) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    req.auth = auth;
    next();
  })().catch(next);
}

/** Alias for requireAdmin — backward compatible with Wave 9 routes */
export const requireOwner = requireAdmin;

/** Require admin OR valid client password scoped to siteId param */
export function requireSiteMember(
  getPasswordHash: (siteId: string) => Promise<string | undefined>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const siteId = routeParam(req.params.siteId);
    const token = extractBearer(req);

    if (token) {
      const adminAuth = await resolveAdminAuth(token);
      if (adminAuth) {
        req.auth = { ...adminAuth, siteId };
        next();
        return;
      }
    }

    if (!token || !siteId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hash = await getPasswordHash(siteId);
    if (!hash) {
      res.status(401).json({ error: 'Client access not configured for this site' });
      return;
    }

    if (!verifyPassword(token, hash)) {
      res.status(401).json({ error: 'Invalid site password' });
      return;
    }

    req.auth = { role: 'client', siteId };
    next();
  };
}

/** @deprecated use requireSiteMember */
export const requireSiteAccess = requireSiteMember;

/** Admin-only actions — blocks client role */
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/** @deprecated use adminOnly */
export const ownerOnly = adminOnly;

/** Helper for route guards that need admin but not client */
export function isAdmin(req: Request): boolean {
  return req.auth?.role === 'admin';
}
