import { z } from 'zod';

export const HumanizerModeSchema = z.enum(['simple', 'skill']);
export type HumanizerMode = z.infer<typeof HumanizerModeSchema>;

export const HumanizerContentTypeSchema = z.enum(['blog', 'email', 'auto']);
export type HumanizerContentType = z.infer<typeof HumanizerContentTypeSchema>;

export const HumanizerSiteConfigSchema = z.object({
  siteId: z.string(),
  mode: HumanizerModeSchema.default('simple'),
  tone: z.string().default('friendly-professional'),
  readingLevel: z.string().default("Bachelor's degree in liberal arts"),
  voiceSample: z.string().optional(),
  customAugment: z.string().optional(),
  contentTypeHint: HumanizerContentTypeSchema.default('auto'),
  updatedAt: z.string(),
});

export type HumanizerSiteConfig = z.infer<typeof HumanizerSiteConfigSchema>;

export const HumanizerWorkspaceDefaultsSchema = z.object({
  defaultMode: HumanizerModeSchema.default('simple'),
  upstreamVersion: z.string().optional(),
  upstreamSyncedAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type HumanizerWorkspaceDefaults = z.infer<typeof HumanizerWorkspaceDefaultsSchema>;

export interface HumanizerReviewScore {
  score: number;
  note: string;
}

export interface HumanizerReview {
  contentType: string;
  assessment: string;
  scores: Record<string, HumanizerReviewScore>;
  patternFlags: Array<{ quote: string; suggestion: string }>;
  topChanges: string[];
}

export interface HumanizeResult {
  humanizedHtml: string;
  mode: HumanizerMode;
  review?: HumanizerReview;
}

export interface HumanizeOptions {
  html: string;
  siteId: string;
  mode?: HumanizerMode;
  contentType?: HumanizerContentType;
  includeReview?: boolean;
}

export interface HumanizerManifest {
  repo: string;
  upstreamPath: string;
  version: string;
  syncedAt: string;
  changelog?: Array<{ date: string; note: string }>;
}
