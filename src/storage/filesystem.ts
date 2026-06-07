import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import type {
  StorageAdapter,
  Site,
  SiteMeta,
  SitePage,
  SiteVersion,
  FormSubmission,
} from './types.js';

const DEFAULT_DATA_DIR = join(process.cwd(), 'data');

export class FileSystemStorage implements StorageAdapter {
  private sitesDir: string;

  constructor(dataDir?: string) {
    const root = dataDir ?? process.env.DATA_DIR ?? DEFAULT_DATA_DIR;
    this.sitesDir = join(root, 'sites');
  }

  private siteDir(siteId: string) {
    return join(this.sitesDir, siteId);
  }

  private metaPath(siteId: string) {
    return join(this.siteDir(siteId), 'meta.json');
  }

  private pagesDir(siteId: string) {
    return join(this.siteDir(siteId), 'pages');
  }

  private versionsDir(siteId: string) {
    return join(this.siteDir(siteId), 'versions');
  }

  private submissionsDir(siteId: string) {
    return join(this.siteDir(siteId), 'submissions');
  }

  async listSites(): Promise<SiteMeta[]> {
    await mkdir(this.sitesDir, { recursive: true });
    const dirs = await readdir(this.sitesDir, { withFileTypes: true });
    const sites: SiteMeta[] = [];

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      try {
        const meta = await this.readJson<SiteMeta>(this.metaPath(dir.name));
        sites.push(meta);
      } catch {
        // skip corrupt entries
      }
    }

    return sites.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getSite(siteId: string): Promise<Site | null> {
    try {
      const meta = await this.readJson<SiteMeta>(this.metaPath(siteId));
      const pages = await this.listPages(siteId);
      return { meta, pages };
    } catch {
      return null;
    }
  }

  async createSite(name: string, domain?: string): Promise<Site> {
    const id = nanoid(12);
    const now = new Date().toISOString();
    const meta: SiteMeta = { id, name, domain, createdAt: now, updatedAt: now };

    await mkdir(this.pagesDir(id), { recursive: true });
    await mkdir(this.versionsDir(id), { recursive: true });
    await this.writeJson(this.metaPath(id), meta);

    return { meta, pages: [] };
  }

  async updateSiteMeta(
    siteId: string,
    patch: Partial<Pick<SiteMeta, 'name' | 'domain' | 'email'>>
  ): Promise<SiteMeta> {
    const meta = await this.readJson<SiteMeta>(this.metaPath(siteId));
    const updated: SiteMeta = {
      ...meta,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.writeJson(this.metaPath(siteId), updated);
    return updated;
  }

  async setClientPassword(siteId: string, passwordHash: string): Promise<void> {
    const meta = await this.readJson<SiteMeta>(this.metaPath(siteId));
    meta.clientPasswordHash = passwordHash;
    meta.updatedAt = new Date().toISOString();
    await this.writeJson(this.metaPath(siteId), meta);
  }

  async deleteSite(siteId: string): Promise<void> {
    await rm(this.siteDir(siteId), { recursive: true, force: true });
  }

  async listPages(siteId: string): Promise<SitePage[]> {
    try {
      const files = await readdir(this.pagesDir(siteId));
      const pages: SitePage[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        pages.push(await this.readJson<SitePage>(join(this.pagesDir(siteId), file)));
      }
      return pages.sort((a, b) => a.path.localeCompare(b.path));
    } catch {
      return [];
    }
  }

  async getPage(siteId: string, pageId: string): Promise<SitePage | null> {
    try {
      return await this.readJson<SitePage>(join(this.pagesDir(siteId), `${pageId}.json`));
    } catch {
      return null;
    }
  }

  async upsertPage(
    siteId: string,
    page: Omit<SitePage, 'updatedAt'> & { updatedAt?: string }
  ): Promise<SitePage> {
    const saved: SitePage = {
      ...page,
      updatedAt: page.updatedAt ?? new Date().toISOString(),
    };
    await mkdir(this.pagesDir(siteId), { recursive: true });
    await this.writeJson(join(this.pagesDir(siteId), `${page.id}.json`), saved);

    const meta = await this.readJson<SiteMeta>(this.metaPath(siteId));
    meta.updatedAt = saved.updatedAt;
    await this.writeJson(this.metaPath(siteId), meta);

    return saved;
  }

  async deletePage(siteId: string, pageId: string): Promise<void> {
    await rm(join(this.pagesDir(siteId), `${pageId}.json`), { force: true });
  }

  async listVersions(siteId: string): Promise<SiteVersion[]> {
    try {
      const files = await readdir(this.versionsDir(siteId));
      const versions: SiteVersion[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        versions.push(await this.readJson<SiteVersion>(join(this.versionsDir(siteId), file)));
      }
      return versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }

  async getVersion(siteId: string, versionId: string): Promise<SiteVersion | null> {
    try {
      return await this.readJson<SiteVersion>(join(this.versionsDir(siteId), `${versionId}.json`));
    } catch {
      return null;
    }
  }

  async createVersion(siteId: string, label: string): Promise<SiteVersion> {
    const pages = await this.listPages(siteId);
    const version: SiteVersion = {
      id: nanoid(10),
      label,
      createdAt: new Date().toISOString(),
      pages: Object.fromEntries(pages.map((p) => [p.id, p.content])),
    };
    await this.writeJson(join(this.versionsDir(siteId), `${version.id}.json`), version);
    return version;
  }

  async restoreVersion(siteId: string, versionId: string): Promise<Site> {
    const version = await this.getVersion(siteId, versionId);
    if (!version) throw new Error(`Version not found: ${versionId}`);

    const existingPages = await this.listPages(siteId);
    const pageMap = new Map(existingPages.map((p) => [p.id, p]));

    for (const [pageId, content] of Object.entries(version.pages)) {
      const existing = pageMap.get(pageId);
      if (existing) {
        await this.upsertPage(siteId, { ...existing, content });
      }
    }

    return (await this.getSite(siteId))!;
  }

  async listSubmissions(siteId: string): Promise<FormSubmission[]> {
    try {
      const files = await readdir(this.submissionsDir(siteId));
      const submissions: FormSubmission[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        submissions.push(await this.readJson<FormSubmission>(join(this.submissionsDir(siteId), file)));
      }
      return submissions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }

  async addSubmission(
    siteId: string,
    submission: Omit<FormSubmission, 'id' | 'siteId' | 'createdAt'>
  ): Promise<FormSubmission> {
    const saved: FormSubmission = {
      ...submission,
      id: nanoid(10),
      siteId,
      createdAt: new Date().toISOString(),
    };
    await mkdir(this.submissionsDir(siteId), { recursive: true });
    await this.writeJson(join(this.submissionsDir(siteId), `${saved.id}.json`), saved);
    return saved;
  }

  async getSubmission(siteId: string, submissionId: string): Promise<FormSubmission | null> {
    try {
      return await this.readJson<FormSubmission>(join(this.submissionsDir(siteId), `${submissionId}.json`));
    } catch {
      return null;
    }
  }

  private async readJson<T>(path: string): Promise<T> {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as T;
  }

  private async writeJson(path: string, data: unknown): Promise<void> {
    await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
  }
}

let storageInstance: StorageAdapter | null = null;

export async function getStorage(): Promise<StorageAdapter> {
  if (storageInstance) return storageInstance;

  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    const { MongoStorage } = await import('./mongo.js');
    storageInstance = new MongoStorage(mongoUri);
  } else {
    storageInstance = new FileSystemStorage();
  }

  return storageInstance;
}
