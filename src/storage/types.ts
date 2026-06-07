import type { PageContent } from '../content/types.js';

export interface SiteMeta {
  id: string;
  name: string;
  domain?: string;
  /** bcrypt hash of client password */
  clientPasswordHash?: string;
  createdAt: string;
  updatedAt: string;
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
  updateSiteMeta(siteId: string, patch: Partial<Pick<SiteMeta, 'name' | 'domain'>>): Promise<SiteMeta>;
  setClientPassword(siteId: string, passwordHash: string): Promise<void>;
  deleteSite(siteId: string): Promise<void>;

  listPages(siteId: string): Promise<SitePage[]>;
  getPage(siteId: string, pageId: string): Promise<SitePage | null>;
  upsertPage(siteId: string, page: Omit<SitePage, 'updatedAt'> & { updatedAt?: string }): Promise<SitePage>;
  deletePage(siteId: string, pageId: string): Promise<void>;

  listVersions(siteId: string): Promise<SiteVersion[]>;
  getVersion(siteId: string, versionId: string): Promise<SiteVersion | null>;
  createVersion(siteId: string, label: string): Promise<SiteVersion>;
  restoreVersion(siteId: string, versionId: string): Promise<Site>;
}
