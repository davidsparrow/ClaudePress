import type { Site, SiteMeta, SitePage, SiteVersion, SlotChange, ContentSlot } from './types';

export type { Site, SiteMeta, SitePage, SiteVersion, SlotChange, ContentSlot };

const TOKEN_KEY = 'claudepress_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return res.json();
  return res.text() as unknown as T;
}

export const api = {
  listSites: () => request<SiteMeta[]>('/sites'),
  getSite: (siteId: string) => request<Site>(`/sites/${siteId}`),
  createSite: (name: string, domain?: string) =>
    request<Site>('/sites', { method: 'POST', body: JSON.stringify({ name, domain }) }),
  setPassword: (siteId: string, password: string) =>
    request<{ ok: boolean }>(`/sites/${siteId}/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  ingestPage: (siteId: string, url: string) =>
    request<SitePage>(`/sites/${siteId}/pages/ingest`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  updatePage: (siteId: string, pageId: string, changes: SlotChange[]) =>
    request<{ page: SitePage; html: string }>(`/sites/${siteId}/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ changes }),
    }),
  listVersions: (siteId: string) => request<SiteVersion[]>(`/sites/${siteId}/versions`),
  createVersion: (siteId: string, label?: string) =>
    request<SiteVersion>(`/sites/${siteId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    }),
  restoreVersion: (siteId: string, versionId: string) =>
    request<Site>(`/sites/${siteId}/versions/${versionId}/restore`, { method: 'POST' }),
  publish: (siteId: string, label?: string, deploy = true) =>
    request<{ publish: { id: string; deploymentUrl?: string }; deploymentUrl?: string }>(
      `/sites/${siteId}/publish`,
      { method: 'POST', body: JSON.stringify({ label, deploy }) }
    ),
  listPublishes: (siteId: string) =>
    request<Array<{ id: string; label: string; createdAt: string; deploymentUrl?: string }>>(
      `/sites/${siteId}/publishes`
    ),
  chat: (siteId: string, pageId: string, message: string) =>
    request<{ explanation: string; html: string; page: SitePage }>(
      `/sites/${siteId}/pages/${pageId}/chat`,
      { method: 'POST', body: JSON.stringify({ message }) }
    ),
  downloadWordPressTheme: async (siteId: string, siteName: string) => {
    const token = getToken();
    const res = await fetch(`/api/sites/${siteId}/wordpress/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error ?? 'Download failed');
    }
    const blob = await res.blob();
    const slug = siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claudepress-${slug}-wordpress-theme.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
