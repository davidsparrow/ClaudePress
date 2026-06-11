import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import type { Db } from 'mongodb';
import type { CampaignStep, EmailCampaign } from '../content/campaign-types.js';

export class CampaignStore {
  private dataDir: string;
  private dbPromise: Promise<Db> | null;

  constructor(options?: { dataDir?: string; dbPromise?: Promise<Db> }) {
    const root = options?.dataDir ?? process.env.DATA_DIR ?? join(process.cwd(), 'data');
    this.dataDir = join(root, 'campaigns');
    this.dbPromise = options?.dbPromise ?? null;
  }

  private campDir(siteId: string) {
    return join(this.dataDir, siteId, 'campaigns');
  }

  private stepDir(siteId: string) {
    return join(this.dataDir, siteId, 'steps');
  }

  async listCampaigns(siteId: string): Promise<EmailCampaign[]> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      return db.collection<EmailCampaign>('email_campaigns').find({ siteId }).toArray();
    }
    try {
      const files = await readdir(this.campDir(siteId));
      const out: EmailCampaign[] = [];
      for (const f of files) {
        if (f.endsWith('.json')) {
          out.push(JSON.parse(await readFile(join(this.campDir(siteId), f), 'utf-8')) as EmailCampaign);
        }
      }
      return out;
    } catch {
      return [];
    }
  }

  async getCampaign(siteId: string, campaignId: string): Promise<EmailCampaign | null> {
    const all = await this.listCampaigns(siteId);
    return all.find((c) => c.id === campaignId) ?? null;
  }

  async saveCampaign(campaign: EmailCampaign): Promise<EmailCampaign> {
    campaign.updatedAt = new Date().toISOString();
    if (this.dbPromise) {
      const db = await this.dbPromise;
      await db.collection('email_campaigns').updateOne(
        { siteId: campaign.siteId, id: campaign.id },
        { $set: campaign },
        { upsert: true }
      );
      return campaign;
    }
    const dir = this.campDir(campaign.siteId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${campaign.id}.json`), JSON.stringify(campaign, null, 2), 'utf-8');
    return campaign;
  }

  async createCampaign(
    siteId: string,
    data: Pick<EmailCampaign, 'pillarId' | 'keyword' | 'name'>
  ): Promise<EmailCampaign> {
    const now = new Date().toISOString();
    const campaign: EmailCampaign = {
      id: nanoid(12),
      siteId,
      pillarId: data.pillarId,
      keyword: data.keyword,
      name: data.name,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    return this.saveCampaign(campaign);
  }

  async listSteps(siteId: string, campaignId: string): Promise<CampaignStep[]> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      return db
        .collection<CampaignStep>('campaign_steps')
        .find({ siteId, campaignId })
        .sort({ order: 1 })
        .toArray();
    }
    try {
      const files = await readdir(this.stepDir(siteId));
      const out: CampaignStep[] = [];
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const step = JSON.parse(await readFile(join(this.stepDir(siteId), f), 'utf-8')) as CampaignStep;
        if (step.campaignId === campaignId) out.push(step);
      }
      return out.sort((a, b) => a.order - b.order);
    } catch {
      return [];
    }
  }

  async saveSteps(siteId: string, campaignId: string, steps: CampaignStep[]): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      await db.collection('campaign_steps').deleteMany({ siteId, campaignId });
      if (steps.length) await db.collection('campaign_steps').insertMany(steps);
      return;
    }
    const dir = this.stepDir(siteId);
    await mkdir(dir, { recursive: true });
    const existing = await this.listSteps(siteId, campaignId);
    for (const s of existing) {
      await rm(join(dir, `${s.id}.json`), { force: true });
    }
    for (const step of steps) {
      await writeFile(join(dir, `${step.id}.json`), JSON.stringify(step, null, 2), 'utf-8');
    }
  }
}

let storeInstance: CampaignStore | null = null;

export async function getCampaignStore(): Promise<CampaignStore> {
  if (storeInstance) return storeInstance;
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(mongoUri);
    const dbName = process.env.FRESHPRESS_DB_NAME || 'claudepress';
    storeInstance = new CampaignStore({ dbPromise: client.connect().then(() => client.db(dbName)) });
  } else {
    storeInstance = new CampaignStore();
  }
  return storeInstance;
}
