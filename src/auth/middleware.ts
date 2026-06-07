import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { routeParam } from '../util/params.js';

export type AuthRole = 'owner' | 'client';

export interface AuthContext {
  role: AuthRole;
  siteId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const MASTER_KEY = process.env.MASTER_KEY ?? '';

/** Simple SHA-256 hash for client passwords (no native bcrypt dep needed for MVP) */
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  const a = Buffer.from(hashPassword(password));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

/** Require owner master key */
export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!MASTER_KEY) {
    res.status(503).json({ error: 'MASTER_KEY not configured on server' });
    return;
  }
  if (!token || !safeCompare(token, MASTER_KEY)) {
    res.status(401).json({ error: 'Invalid or missing master key' });
    return;
  }
  req.auth = { role: 'owner' };
  next();
}

/** Require owner OR valid client password scoped to siteId param */
export function requireSiteAccess(
  getPasswordHash: (siteId: string) => Promise<string | undefined>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const siteId = routeParam(req.params.siteId);
    const token = extractBearer(req);

    if (token && MASTER_KEY && safeCompare(token, MASTER_KEY)) {
      req.auth = { role: 'owner', siteId };
      next();
      return;
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

/** Client role cannot perform owner-only actions */
export function ownerOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.auth?.role !== 'owner') {
    res.status(403).json({ error: 'Owner access required' });
    return;
  }
  next();
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
