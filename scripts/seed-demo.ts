#!/usr/bin/env npx tsx
/**
 * Shared seed data script for demo instance and buyer onboarding.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts            # seed (idempotent)
 *   npx tsx scripts/seed-demo.ts --reset    # drop demo data & re-seed (demo only)
 *   npx tsx scripts/seed-demo.ts --buyer    # buyer onboarding variant (no auto-reset)
 *
 * Requires: MONGODB_URI in env (for hosted) or uses DATA_DIR for filesystem mode.
 * Optional: FRESHPRESS_DB_NAME (defaults to "claudepress")
 */

import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { WorkspaceUsersStore } from '../src/storage/workspace-users.js';
import { BlogSiloStore } from '../src/storage/blog-silo.js';
import { SocialPostsStore } from '../src/storage/social-posts.js';
import { getStorage } from '../src/storage/filesystem.js';
import type { SocialGenerationBatch, SocialPostDraft } from '../src/content/social-types.js';
import type { BlogPillar, BlogPost } from '../src/content/silo-types.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

// ── seed content ──────────────────────────────────────────────────────────────

const DEMO_BLOG_HTML = `
<h1>5 Signs Your Water Heater Needs Replacement</h1>
<p>Your water heater is one of the hardest-working appliances in your home. But like all mechanical
systems, it has a finite lifespan. Knowing when to replace it — rather than repair it — can save you
from a cold-shower emergency and expensive water damage.</p>

<h2>1. Age beyond 10–15 years</h2>
<p>Most conventional tank water heaters last 10 to 15 years. If yours is approaching that range,
start planning for replacement even if it seems to work fine. The efficiency drop alone often makes
the upgrade worthwhile.</p>

<h2>2. Rust-coloured or metallic-tasting water</h2>
<p>Rusty water from the hot tap — but not the cold — points to corrosion inside the tank. Once the
tank itself starts corroding, no repair will extend its life meaningfully.</p>

<h2>3. Rumbling or popping sounds</h2>
<p>Sediment builds up on the bottom of the tank over years of use. As the heater works to warm water
through that layer, you'll hear rumbling, popping, or knocking sounds. Flushing sometimes helps, but
in an older unit it often means the end is near.</p>

<h2>4. Leaks around the base</h2>
<p>Even a slow drip around the base of the tank signals internal fractures from years of thermal
expansion and contraction. A leaking tank cannot be repaired — replace it before it fails fully.</p>

<h2>5. Inconsistent hot water</h2>
<p>If your showers start hot and go cold quickly, or you never quite get the temperature you set,
the heating element or thermostat may be failing. In an older unit, the cost of parts and labour often
exceeds the value of the repair.</p>

<h2>What to do next</h2>
<p>If two or more of these signs apply to your water heater, call Acme Plumbing &amp; HVAC for a
free assessment. We carry tank and tankless options and can typically complete installation the same
day.</p>
`.trim();

const DEMO_SITE_NAME = 'Acme Plumbing & HVAC';

// ── db init ───────────────────────────────────────────────────────────────────

async function connectDb(): Promise<import('mongodb').Db | null> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) return null;
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(mongoUri);
  await client.connect();
  const dbName = process.env.FRESHPRESS_DB_NAME ?? 'claudepress';
  return client.db(dbName);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const isBuyer = flag('buyer');
  const isReset = flag('reset');

  console.log(`[seed] mode=${isBuyer ? 'buyer' : 'demo'} reset=${isReset}`);

  const db = await connectDb();
  const dbPromise = db ? Promise.resolve(db) : null;
  const opts = dbPromise ? { dbPromise } : undefined;

  const usersStore = new WorkspaceUsersStore(opts);
  const blogStore = new BlogSiloStore(opts);
  const socialStore = new SocialPostsStore(opts);
  const storage = await getStorage();

  // ── Reset demo data ───────────────────────────────────────────────────────

  if (isReset) {
    if (!db) {
      console.warn('[seed] --reset only works in MongoDB mode; skipping drop in filesystem mode');
    } else {
      console.log('[seed] resetting collections…');
      await db.collection('workspaces').deleteMany({});
      await db.collection('workspace_users').deleteMany({});
      await db.collection('sessions').deleteMany({});
      // Find and drop the demo site data
      const sites = await storage.listSites();
      const demoSite = sites.find((s) => s.name === DEMO_SITE_NAME);
      if (demoSite) {
        await db.collection('blog_pillars').deleteMany({ siteId: demoSite.id });
        await db.collection('blog_posts').deleteMany({ siteId: demoSite.id });
        await db.collection('social_batches').deleteMany({ siteId: demoSite.id });
        await db.collection('social_drafts').deleteMany({ siteId: demoSite.id });
        await storage.deleteSite(demoSite.id);
      }
      await db.collection('early_access_leads').deleteMany({});
      console.log('[seed] reset complete');
    }
  }

  // ── Workspace ─────────────────────────────────────────────────────────────

  const workspaceName = isBuyer ? 'FreshPress Sample Agency' : 'FreshPress Demo Agency';
  let workspace = await usersStore.getWorkspace();
  if (!workspace) {
    workspace = await usersStore.createWorkspace(workspaceName, 'agency');
    console.log(`[seed] workspace created: ${workspace.id}`);
  } else {
    console.log(`[seed] workspace exists: ${workspace.id}`);
  }

  // ── Admin user ────────────────────────────────────────────────────────────

  const userEmail = isBuyer ? 'owner@sample.freshpress.dev' : 'demo@freshpress.dev';
  const userDisplay = isBuyer ? 'Sample Owner' : 'Demo Admin';

  let demoUser = await usersStore.getUserByEmail(userEmail);
  if (!demoUser) {
    // For buyer mode generate a random password (shown once); for demo use a fixed known value
    const password = isBuyer
      ? randomBytes(16).toString('hex')
      : 'demo-password-rotate-me';
    demoUser = await usersStore.createUser({
      workspaceId: workspace.id,
      email: userEmail,
      passwordHash: hashPassword(password),
      displayName: userDisplay,
      role: 'owner',
    });
    if (isBuyer) {
      console.log(`[seed] admin user created: ${userEmail}`);
      console.log(`[seed] TEMP PASSWORD (shown once): ${password}`);
    } else {
      console.log(`[seed] demo user created: ${userEmail}`);
    }
  } else {
    console.log(`[seed] user exists: ${userEmail}`);
  }

  // ── Demo site ─────────────────────────────────────────────────────────────

  const existingSites = await storage.listSites();
  const existingSite = existingSites.find((s) => s.name === DEMO_SITE_NAME);

  let siteId: string;
  if (!existingSite) {
    const site = await storage.createSite(DEMO_SITE_NAME, 'acme-plumbing.example.com');
    siteId = site.meta.id;
    console.log(`[seed] site created: ${siteId} (${DEMO_SITE_NAME})`);
  } else {
    siteId = existingSite.id;
    console.log(`[seed] site exists: ${siteId}`);
  }

  // ── Blog pillar ───────────────────────────────────────────────────────────

  const existingPillars = await blogStore.listPillars(siteId);
  let pillar: BlogPillar;

  if (existingPillars.length === 0) {
    const now = new Date().toISOString();
    pillar = {
      id: nanoid(12),
      siteId,
      keyword: 'water heater replacement',
      slug: 'water-heater-replacement',
      title: 'Water Heater Replacement Guide',
      metaTitle: 'Water Heater Replacement | Acme Plumbing & HVAC',
      metaDescription:
        'Everything homeowners need to know about replacing a water heater — signs, costs, and what to expect.',
      order: 0,
      createdAt: now,
      updatedAt: now,
    };
    await blogStore.savePillar(pillar);
    console.log(`[seed] pillar created: ${pillar.id}`);
  } else {
    pillar = existingPillars[0];
    console.log(`[seed] pillar exists: ${pillar.id}`);
  }

  // ── Blog post ─────────────────────────────────────────────────────────────

  const existingPosts = await blogStore.listPosts(siteId, pillar.id);
  let post: BlogPost;

  if (existingPosts.length === 0) {
    const now = new Date().toISOString();
    post = {
      id: nanoid(12),
      siteId,
      pillarId: pillar.id,
      kind: 'supportive',
      title: '5 Signs Your Water Heater Needs Replacement',
      slug: '5-signs-water-heater-needs-replacement',
      keyword: 'signs water heater needs replacement',
      bodyHtml: DEMO_BLOG_HTML,
      status: 'published',
      metaTitle: '5 Signs Your Water Heater Needs Replacement | Acme Plumbing',
      metaDescription:
        'Rust, leaks, odd sounds, and age are warning signs. Learn when to replace vs repair your water heater.',
      order: 0,
      publishedAt: now,
      socialGenerationMeta: { runCount: 1, usedSections: ['h2:1'] },
      createdAt: now,
      updatedAt: now,
    };
    await blogStore.savePost(post);
    console.log(`[seed] post created: ${post.id}`);
  } else {
    post = existingPosts[0];
    console.log(`[seed] post exists: ${post.id}`);
  }

  // ── Social batch + drafts ─────────────────────────────────────────────────

  const existingBatches = await socialStore.listBatches(siteId, { sourcePostId: post.id });

  if (existingBatches.length === 0) {
    const now = new Date().toISOString();
    const batchId = nanoid(12);

    const batch: SocialGenerationBatch = {
      id: batchId,
      siteId,
      sourcePostId: post.id,
      generationRun: 1,
      sourceSection: 'h2:1',
      targetKeywords: ['water heater replacement', 'plumbing services'],
      status: 'pending_review',
      variants: [
        {
          id: nanoid(10),
          platform: 'linkedin',
          variantIndex: 1,
          bodyText:
            "Is your water heater making rumbling sounds or producing rusty water? These are two of the clearest signs it's time for a replacement — not a repair.\n\nAt Acme Plumbing & HVAC, we've seen costly water damage from tanks that homeowners waited too long to replace. The good news? Same-day installation is available.\n\nHere are the 5 warning signs every homeowner should know 👇",
          suggestedTags: ['plumbing', 'homeimprovement', 'waterheater', 'hvac'],
          images: {},
        },
        {
          id: nanoid(10),
          platform: 'x',
          variantIndex: 1,
          bodyText:
            "Rusty water from the hot tap, strange sounds, or a unit older than 12 years?\n\nTime to plan for a new water heater — before it plans for you.\n\nAcme Plumbing & HVAC offers same-day installs 🔧",
          suggestedTags: ['plumbing', 'homeimprovement', 'waterheater'],
          images: {},
        },
        {
          id: nanoid(10),
          platform: 'facebook',
          variantIndex: 1,
          bodyText:
            "Homeowners: don't wait for a full breakdown to replace your water heater. Here are 5 signs it's time to call us — and why catching it early saves you money and headache.\n\n📞 Call Acme Plumbing & HVAC for a free assessment. Same-day installation available!",
          suggestedTags: ['plumbing', 'waterheater', 'homeimprovement', 'localservice'],
          images: {},
        },
      ],
      createdAt: now,
    };

    await socialStore.saveBatch(batch);
    console.log(`[seed] social batch created: ${batchId}`);

    // One pre-promoted draft so the Drafts tab is populated for demo visitors
    const draft: SocialPostDraft = {
      id: nanoid(12),
      siteId,
      sourcePostId: post.id,
      batchId,
      platform: 'linkedin',
      accountId: 'demo-linkedin',
      bodyText:
        "Is your water heater making rumbling sounds? That's sediment buildup — a sure sign the unit is near end of life.\n\nAt Acme Plumbing & HVAC, we recommend proactive replacement once a unit hits 10–12 years. Same-day installs available in the metro area.\n\nLearn all 5 warning signs at the link below:",
      tags: ['plumbing', 'homeimprovement', 'waterheater', 'hvac'],
      status: 'draft',
      targetKeywords: ['water heater replacement'],
      sourceSection: 'h2:1',
      generationRun: 1,
      images: {},
      createdAt: now,
      updatedAt: now,
    };

    await socialStore.saveDraft(draft);
    console.log(`[seed] social draft created: ${draft.id}`);
  } else {
    console.log(`[seed] social data exists for post ${post.id}`);
  }

  // ── Buyer onboarding checklist ────────────────────────────────────────────

  if (isBuyer) {
    const dataDir = process.env.DATA_DIR ?? join(process.cwd(), 'data');
    const checklistPath = join(dataDir, 'onboarding-checklist.md');
    await mkdir(dataDir, { recursive: true });
    await writeFile(
      checklistPath,
      `# FreshPress Onboarding Checklist

Your instance includes a sample site ("${DEMO_SITE_NAME}") to explore.

## Getting started

- [ ] Log in with your MASTER_KEY (see your handoff email)
- [ ] Explore the sample site: Blog, Social pipeline, Site Settings
- [ ] Add your Vercel token in Admin → Integrations
- [ ] Add your AI keys in Admin → AI Providers
- [ ] Create your first real client site (+Add Site in Admin)
- [ ] Set a client password and share the invite link (Site Settings → Access)
- [ ] Delete the "${DEMO_SITE_NAME}" sample site when ready

## Reference docs

- \`docs/BUYER-SETUP.md\` — full buyer walkthrough
- \`docs/HOSTED-INSTANCE.md\` — environment and platform setup
- \`docs/DEPLOYMENT-ECOSYSTEM.md\` — how the whole stack fits together
`,
      'utf-8'
    );
    console.log(`[seed] onboarding checklist written: ${checklistPath}`);
  }

  console.log('[seed] done ✓');
  process.exit(0);
}

main().catch((e) => {
  console.error('[seed] error:', e);
  process.exit(1);
});
