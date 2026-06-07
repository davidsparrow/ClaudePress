import type { PageContent } from '../content/types.js';
import type {
  Author,
  Category,
  Tag,
  MediaAsset,
  Article,
  Comment,
  ImportJob,
} from '../content/blog-types.js';

/** Per-site Resend config — buyers use their own Resend account (BYOK) */
export interface SiteEmailConfig {
  resendApiKey?: string;
  fromEmail?: string;
  fromName?: string;
  /** Inbox that receives contact form notifications */
  notifyEmail?: string;
  /** Plain-text message shown after successful submit (stored; public API uses generic success for now) */
  successMessage?: string;
  enabled?: boolean;
}

export interface SiteMeta {
  id: string;
  name: string;
  domain?: string;
  /** Original WordPress site URL when imported from WXR */
  sourceBaseUrl?: string;
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
  updateSiteMeta(
    siteId: string,
    patch: Partial<Pick<SiteMeta, 'name' | 'domain' | 'email' | 'sourceBaseUrl'>>
  ): Promise<SiteMeta>;
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

  // Blog content (WordPress import)
  upsertAuthor(siteId: string, author: Omit<Author, 'siteId' | 'createdAt'> & { createdAt?: string }): Promise<Author>;
  listAuthors(siteId: string): Promise<Author[]>;

  upsertCategory(siteId: string, category: Omit<Category, 'siteId' | 'createdAt'> & { createdAt?: string }): Promise<Category>;
  listCategories(siteId: string): Promise<Category[]>;

  upsertTag(siteId: string, tag: Omit<Tag, 'siteId' | 'createdAt'> & { createdAt?: string }): Promise<Tag>;
  listTags(siteId: string): Promise<Tag[]>;

  upsertMediaAsset(siteId: string, asset: Omit<MediaAsset, 'siteId' | 'createdAt'> & { createdAt?: string }): Promise<MediaAsset>;
  listMediaAssets(siteId: string): Promise<MediaAsset[]>;

  upsertArticle(siteId: string, article: Omit<Article, 'siteId' | 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }): Promise<Article>;
  listArticles(siteId: string): Promise<Article[]>;
  getArticle(siteId: string, articleId: string): Promise<Article | null>;

  upsertComment(siteId: string, comment: Omit<Comment, 'siteId' | 'createdAt'> & { createdAt?: string }): Promise<Comment>;
  listComments(siteId: string): Promise<Comment[]>;

  createImportJob(siteId: string): Promise<ImportJob>;
  getImportJob(siteId: string, jobId: string): Promise<ImportJob | null>;
  updateImportJob(siteId: string, job: ImportJob): Promise<ImportJob>;

  /** Absolute path to site's public media directory */
  getSitePublicDir(siteId: string): string;
}
