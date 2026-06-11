#!/usr/bin/env npx tsx
/**
 * Vendor CLI: scaffold buyer handoff packet (Atlas + env template).
 * Railway/Fly project creation requires vendor API tokens — fill in manually for Sprint 1.
 *
 * Usage: npx tsx scripts/provision-buyer.ts --slug acme --name "Acme Agency" --domain acme-cms.example.com
 */

import { randomBytes } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const slug = arg('slug');
  const name = arg('name') ?? slug;
  const domain = arg('domain') ?? `${slug}-cms.freshpress.app`;

  if (!slug) {
    console.error('Usage: --slug acme --name "Acme Agency" --domain acme-cms.example.com');
    process.exit(1);
  }

  const masterKey = randomBytes(32).toString('hex');
  const mongoDb = `freshpress_${slug}`;
  const appUrl = domain.startsWith('http') ? domain : `https://${domain}`;

  const entry = {
    buyerName: name,
    slug,
    domain: appUrl.replace(/^https?:\/\//, ''),
    mongoDbName: mongoDb,
    status: 'active',
    provisionedAt: new Date().toISOString(),
    plan: 'standard',
  };

  const registryPath = join(process.cwd(), 'data', 'vendor', 'instance-registry.json');
  await mkdir(join(process.cwd(), 'data', 'vendor'), { recursive: true });

  let registry: typeof entry[] = [];
  try {
    const { readFile } = await import('node:fs/promises');
    registry = JSON.parse(await readFile(registryPath, 'utf-8')) as typeof entry[];
  } catch {
    registry = [];
  }
  registry.push(entry);
  await writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');

  const handoff = `# Buyer handoff: ${name}

CMS URL: ${appUrl}
MASTER_KEY: ${masterKey}

## Env (set on Railway/Fly)

HOSTED=1
MASTER_KEY=${masterKey}
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/${mongoDb}
APP_URL=${appUrl}
DATA_DIR=/data
FRESHPRESS_DB_NAME=${mongoDb}

## Next steps

1. Create Atlas database \`${mongoDb}\`
2. Create Railway service + volume at /data
3. Set env vars above
4. Deploy; verify ${appUrl}/api/health
5. Send buyer BUYER-SETUP.md

`;

  const handoffPath = join(process.cwd(), 'data', 'vendor', `handoff-${slug}.md`);
  await writeFile(handoffPath, handoff, 'utf-8');

  console.log(`Registry updated: ${registryPath}`);
  console.log(`Handoff written: ${handoffPath}`);
  console.log(`MASTER_KEY (deliver securely once): ${masterKey}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
