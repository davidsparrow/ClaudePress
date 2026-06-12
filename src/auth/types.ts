import { z } from 'zod';

export const PlanTierSchema = z.enum(['free', 'pro', 'agency']);
export type PlanTier = z.infer<typeof PlanTierSchema>;

export const WorkspaceUserRoleSchema = z.enum(['owner', 'admin', 'member']);
export type WorkspaceUserRole = z.infer<typeof WorkspaceUserRoleSchema>;

export const UserPreferencesSchema = z.object({
  defaultHumanizerMode: z.enum(['simple', 'skill']).optional(),
  lastSiteId: z.string().optional(),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  planTier: PlanTierSchema.default('free'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const WorkspaceUserSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  displayName: z.string(),
  role: WorkspaceUserRoleSchema,
  preferences: UserPreferencesSchema.default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorkspaceUser = z.infer<typeof WorkspaceUserSchema>;

export const SessionSchema = z.object({
  tokenHash: z.string(),
  userId: z.string(),
  workspaceId: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

/** Request auth — admin (agency) or client (site password). */
export type AuthRole = 'admin' | 'client';

export interface AuthContext {
  role: AuthRole;
  userId?: string;
  workspaceId?: string;
  siteId?: string;
  userRole?: WorkspaceUserRole;
  planTier?: PlanTier;
}

export interface AuthMeResponse {
  role: AuthRole;
  user?: {
    id: string;
    email: string;
    displayName: string;
    role: WorkspaceUserRole;
    preferences: UserPreferences;
  };
  workspace?: {
    id: string;
    name: string;
    planTier: PlanTier;
  };
  siteId?: string;
}
