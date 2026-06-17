/**
 * Demo mode middleware — active only when DEMO_MODE=1.
 *
 * Responsibilities:
 *  - Block destructive or sensitive operations so demo visitors can't break shared state
 *  - Export a shared rate limiter for AI routes
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

export const DEMO_MODE = process.env.DEMO_MODE === '1';

/**
 * Rate limiter for AI-heavy routes in demo mode.
 * 20 requests per IP per hour. No-op when not in demo mode.
 */
export const demoAiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: DEMO_MODE ? 20 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !DEMO_MODE,
  message: { error: 'AI rate limit reached. Please try again in an hour.' },
});

/** Paths that are blocked in demo mode (exact match or prefix). */
const BLOCKED_EXACT: ReadonlySet<string> = new Set([
  '/api/auth/bootstrap',
]);

/** Method+path prefixes blocked in demo mode. */
const BLOCKED_PREFIXES: ReadonlyArray<{ method: string; prefix: string }> = [
  // Integrations: don't allow saving real API keys
  { method: 'PUT', prefix: '/api/admin/integrations' },
  { method: 'PATCH', prefix: '/api/admin/integrations' },
  // Publishing: no real Vercel deploys
  { method: 'POST', prefix: '/api/sites/' },  // covers /api/sites/:id/publish
  // Site delete
  { method: 'DELETE', prefix: '/api/sites/' },
  // WordPress import (heavyweight)
  { method: 'POST', prefix: '/api/sites/' }, // covered via specific sub-check below
];

/** More precise set of blocked (method, path-substring) pairs. */
const BLOCKED_OPERATIONS: ReadonlyArray<{ method: string; pathIncludes: string }> = [
  { method: 'POST', pathIncludes: '/publish' },
  { method: 'DELETE', pathIncludes: '/sites/' },
  { method: 'POST', pathIncludes: '/wordpress-import' },
  { method: 'PUT', pathIncludes: '/integrations' },
  { method: 'PATCH', pathIncludes: '/integrations' },
];

/**
 * Middleware that blocks destructive operations in demo mode.
 * Mount globally in server.ts before other API routers.
 */
export function demoGuard(req: Request, res: Response, next: NextFunction): void {
  if (!DEMO_MODE) {
    next();
    return;
  }

  const { method, path } = req;

  if (BLOCKED_EXACT.has(path)) {
    res.status(403).json({ error: 'This action is disabled in the demo.' });
    return;
  }

  for (const op of BLOCKED_OPERATIONS) {
    if (method === op.method && path.includes(op.pathIncludes)) {
      res.status(403).json({ error: 'This action is disabled in the demo.' });
      return;
    }
  }

  next();
}
