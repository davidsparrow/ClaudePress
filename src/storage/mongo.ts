import { MongoClient, type Db } from 'mongodb';
import { nanoid } from 'nanoid';
import type {
  StorageAdapter,
  Site,
  SiteMeta,
  SitePage,
  SiteVersion,
} from './types.js';

/** MongoDB storage — activated when MONGODB_URI is set */
export class MongoStorage implements StorageAdapter {
  private client: MongoClient;
  private dbPromise: Promise<Db>;

  constructor(uri: string) {
    this.client = new MongoClient(uri);
    this.dbPromise = this.client.connect().then(() => this.client.db('claudepress'));
  }

  private async db(): Promise<Db> {
    return this.dbPromise;
  }

  async listSites(): Promise<SiteMeta[]> {
    const db = await this.db();
    return db.collection<SiteMeta>('sites').find().sort({ updatedAt: -1 }).toArray();
  }

  async getSite(siteId: string): Promise<Site | null> {
    const db = await this.db();
    const meta = await db.collection<SiteMeta>('sites').findOne({ id: siteId });
    if (!meta) return null;
    const pages = await this.listPages(siteId);
    return { meta, pages };
  }

  async createSite(name: string, domain?: string): Promise<Site> {
    const db = await this.db();
    const now = new Date().toISOString();
    const meta: SiteMeta = { id: nanoid(12), name, domain, createdAt: now, updatedAt: now };
    await db.collection<SiteMeta>('sites').insertOne(meta);
    return { meta, pages: [] };
  }

  async updateSiteMeta(
    siteId: string,
    patch: Partial<Pick<SiteMeta, 'name' | 'domain'>>
  ): Promise<SiteMeta> {
    const db = await this.db();
    const updatedAt = new Date().toISOString();
    await db.collection<SiteMeta>('sites').updateOne({ id: siteId }, { $set: { ...patch, updatedAt } });
    const meta = await db.collection<SiteMeta>('sites').findOne({ id: siteId });
    if (!meta) throw new Error(`Site not found: ${siteId}`);
    return meta;
  }

  async setClientPassword(siteId: string, passwordHash: string): Promise<void> {
    const db = await this.db();
    await db
      .collection<SiteMeta>('sites')
      .updateOne({ id: siteId }, { $set: { clientPasswordHash: passwordHash, updatedAt: new Date().toISOString() } });
  }

  async deleteSite(siteId: string): Promise<void> {
    const db = await this.db();
    await db.collection<SiteMeta>('sites').deleteOne({ id: siteId });
    await db.collection<SitePage>('pages').deleteMany({ siteId });
    await db.collection<SiteVersion>('versions').deleteMany({ siteId });
  }

  async listPages(siteId: string): Promise<SitePage[]> {
    const db = await this.db();
    return db.collection<SitePage>('pages').find({ siteId }).sort({ path: 1 }).toArray();
  }

  async getPage(siteId: string, pageId: string): Promise<SitePage | null> {
    const db = await this.db();
    return db.collection<SitePage>('pages').findOne({ siteId, id: pageId });
  }

  async upsertPage(
    siteId: string,
    page: Omit<SitePage, 'updatedAt'> & { updatedAt?: string }
  ): Promise<SitePage> {
    const db = await this.db();
    const saved: SitePage & { siteId: string } = {
      ...page,
      siteId,
      updatedAt: page.updatedAt ?? new Date().toISOString(),
    };
    await db.collection('pages').updateOne(
      { siteId, id: page.id },
      { $set: saved },
      { upsert: true }
    );
    await db.collection<SiteMeta>('sites').updateOne({ id: siteId }, { $set: { updatedAt: saved.updatedAt } });
    return saved;
  }

  async deletePage(siteId: string, pageId: string): Promise<void> {
    const db = await this.db();
    await db.collection<SitePage>('pages').deleteOne({ siteId, id: pageId });
  }

  async listVersions(siteId: string): Promise<SiteVersion[]> {
    const db = await this.db();
    return db
      .collection<SiteVersion & { siteId: string }>('versions')
      .find({ siteId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getVersion(siteId: string, versionId: string): Promise<SiteVersion | null> {
    const db = await this.db();
    return db.collection<SiteVersion>('versions').findOne({ siteId, id: versionId });
  }

  async createVersion(siteId: string, label: string): Promise<SiteVersion> {
    const pages = await this.listPages(siteId);
    const version: SiteVersion & { siteId: string } = {
      id: nanoid(10),
      label,
      createdAt: new Date().toISOString(),
      pages: Object.fromEntries(pages.map((p) => [p.id, p.content])),
      siteId,
    };
    const db = await this.db();
    await db.collection('versions').insertOne(version);
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
}
