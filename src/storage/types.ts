import type { PageContent } from '../content/types.js';

/** Per-site Resend config — buyers use their own Resend account (BYOK) */
export interface SiteEmailConfig {
  resendApiKey?: string;
  fromEmail?: string;
  fromName?: string;
  /** Inbox that receives contact form notifications */
  notifyEmail?: string;
  enabled?: boolean;
}

export interface SiteMeta {
  id: string;
  name: string;
  domain?: string;
  /** bcrypt hash of client password */
  clientPasswordHash?: string;
  email?: SiteEmailConfig;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmission {
  id: string;
  siteId: string;
  name: string;
  email: string;
  message: string;
  pagePath?: string;
  createdAt: string;
}

export interface SitePage {
  id: string;
  path: string;
  title: string;
  sourceUrl?: string;
  content: PageContent;
  updatedAt: string;
}

export interface SiteVersion {
  id: string;
  label: string;
  createdAt: string;
  /** pageId -> snapshot of PageContent */
  pages: Record<string, PageContent>;
}

export interface Site {
  meta: SiteMeta;
  pages: SitePage[];
}

export interface StorageAdapter {
  listSites(): Promise<SiteMeta[]>;
  getSite(siteId: string): Promise<Site | null>;
  createSite(name: string, domain?: string): Promise<Site>;
  updateSiteMeta(siteId: string, patch: Partial<Pick<SiteMeta, 'name' | 'domain' | 'email'>>): Promise<SiteMeta>;
  setClientPassword(siteId: string, passwordHash: string): Promise<void>;
  deleteSite(siteId: string): Promise<void>;

  listSubmissions(siteId: string): Promise<FormSubmission[]>;
  addSubmission(siteId: string, submission: Omit<FormSubmission, 'id' | 'siteId' | 'createdAt'>): Promise<FormSubmission>;
  getSubmission(siteId: string, submissionId: string): Promise<FormSubmission | null>;

  listPages(siteId: string): Promise<SitePage[]>;
  getPage(siteId: string, pageId: string): Promise<SitePage | null>;
  upsertPage(siteId: string, page: Omit<SitePage, 'updatedAt'> & { updatedAt?: string }): Promise<SitePage>;
  deletePage(siteId: string, pageId: string): Promise<void>;

  listVersions(siteId: string): Promise<SiteVersion[]>;
  getVersion(siteId: string, versionId: string): Promise<SiteVersion | null>;
  createVersion(siteId: string, label: string): Promise<SiteVersion>;
  restoreVersion(siteId: string, versionId: string): Promise<Site>;
}
