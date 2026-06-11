import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import themesManifest from './themes-manifest.json' with { type: 'json' };

const MANIFEST_BASE =
  'https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md';

export interface ThemeManifestEntry {
  id: string;
  name: string;
  desc: string;
  aesthetic: string;
}

export function listThemes(): ThemeManifestEntry[] {
  return themesManifest as ThemeManifestEntry[];
}

export async function fetchDesignMd(themeId: string): Promise<string> {
  const url = `${MANIFEST_BASE}/${themeId}/DESIGN.md`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch DESIGN.md for ${themeId}`);
  }
  return response.text();
}

const cache = new Map<string, string>();

export async function getDesignMdCached(themeId: string): Promise<string> {
  if (cache.has(themeId)) return cache.get(themeId)!;
  const raw = await fetchDesignMd(themeId);
  cache.set(themeId, raw);
  return raw;
}

export function clearDesignMdCache(): void {
  cache.clear();
}

export async function loadBundledManifest(): Promise<ThemeManifestEntry[]> {
  const path = join(process.cwd(), 'src', 'design', 'themes-manifest.json');
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as ThemeManifestEntry[];
  } catch {
    return listThemes();
  }
}
