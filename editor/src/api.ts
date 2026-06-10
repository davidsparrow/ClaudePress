import type { Site, SiteMeta, SitePage, SiteVersion, SlotChange, ContentSlot } from './types';

export type { Site, SiteMeta, SitePage, SiteVersion, SlotChange, ContentSlot };

export interface ImportPreview {
  siteName: string;
  siteUrl?: string;
  suggestedDomain?: string;
  counts: {
    authors: number;
    categories: number;
    tags: number;
    attachments: number;
    articles: number;
    comments: number;
    sitePages: number;
    mediaFailed: number;
  };
  authors: Array<{ login: string; displayName: string; email: string }>;
  pages: Array<{ slug: string; title: string; wpPostId: number }>;
}

export interface ImportJob {
  id: string;
  siteId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  errors: string[];
  stats: ImportPreview['counts'];
  createdAt: string;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  publicPath: string;
  relativePath: string;
  mimeType?: string;
  sourceUrl?: string;
  wpPostId?: number;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  siteId: string;
  pillarId: string;
  kind: 'pillar' | 'supportive';
  title: string;
  slug: string;
  keyword: string;
  bodyHtml: string;
  status: 'draft' | 'published' | 'scheduled';
  metaTitle?: string;
  metaDescription?: string;
  order: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPillar {
  id: string;
  siteId: string;
  keyword: string;
  slug: string;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlogSilo {
  pillar: BlogPillar;
  posts: BlogPost[];
}

export interface PublishRecord {
  id: string;
  siteId: string;
  label: string;
  createdAt: string;
  pageCount: number;
  prePublishVersionId?: string;
  deploymentUrl?: string;
  vercelDeploymentId?: string;
}

const TOKEN_KEY = 'freshpress_token';
const LEGACY_TOKEN_KEYS = ['presspal_token', 'claudepress_token'] as const;

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) return token;
  for (const legacyKey of LEGACY_TOKEN_KEYS) {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy) {
      localStorage.setItem(TOKEN_KEY, legacy);
      localStorage.removeItem(legacyKey);
      return legacy;
    }
  }
  return null;
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  for (const legacyKey of LEGACY_TOKEN_KEYS) {
    localStorage.removeItem(legacyKey);
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  for (const legacyKey of LEGACY_TOKEN_KEYS) {
    localStorage.removeItem(legacyKey);
  }
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
  listPublishes: (siteId: string) => request<PublishRecord[]>(`/sites/${siteId}/publishes`),
  rollbackPublish: (siteId: string, publishId: string) =>
    request<{ ok: boolean; versionId: string; publish: PublishRecord }>(
      `/sites/${siteId}/publishes/${publishId}/rollback`,
      { method: 'POST' }
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
    a.download = `freshpress-${slug}-wordpress-theme.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },
  previewWordPressImport: async (wxrFile: File): Promise<ImportPreview> => {
    const token = getToken();
    const form = new FormData();
    form.append('wxr', wxrFile);
    const res = await fetch('/api/import/wordpress/preview', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error ?? 'Preview failed');
    }
    return res.json();
  },
  importWordPress: async (
    wxrFile: File,
    opts: {
      sourceBaseUrl?: string;
      uploadsZip?: File;
      sitePageSlugs?: string[];
      importDrafts?: boolean;
    }
  ): Promise<{ siteId: string; jobId: string; job: ImportJob }> => {
    const token = getToken();
    const form = new FormData();
    form.append('wxr', wxrFile);
    if (opts.sourceBaseUrl) form.append('sourceBaseUrl', opts.sourceBaseUrl);
    if (opts.uploadsZip) form.append('uploadsZip', opts.uploadsZip);
    if (opts.sitePageSlugs) form.append('sitePageSlugs', JSON.stringify(opts.sitePageSlugs));
    if (opts.importDrafts) form.append('importDrafts', 'true');
    const res = await fetch('/api/import/wordpress', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error ?? 'Import failed');
    }
    return res.json();
  },
  listArticles: (siteId: string) =>
    request<Array<{ id: string; title: string; slug: string; type: string }>>(
      `/sites/${siteId}/blog/articles`
    ),
  getEmailSettings: (siteId: string) =>
    request<{
      settings: {
        enabled: boolean;
        fromEmail?: string;
        fromName?: string;
        notifyEmail?: string;
        successMessage?: string;
        hasApiKey?: boolean;
        apiKeyPreview?: string;
      };
      editorUrl: string;
      contactFormSnippet: string;
    }>(`/sites/${siteId}/email`),
  updateEmailSettings: (
    siteId: string,
    body: {
      resendApiKey?: string;
      fromEmail?: string;
      fromName?: string;
      notifyEmail?: string;
      successMessage?: string;
      enabled?: boolean;
    }
  ) =>
    request<{ settings: { enabled: boolean; notifyEmail?: string; successMessage?: string; hasApiKey?: boolean } }>(
      `/sites/${siteId}/email`,
      { method: 'PUT', body: JSON.stringify(body) }
    ),
  listSubmissions: (siteId: string) =>
    request<Array<{ id: string; name: string; email: string; message: string; pagePath?: string; createdAt: string }>>(
      `/sites/${siteId}/submissions`
    ),
  sendTestEmail: (siteId: string, to: string) =>
    request<{ ok: boolean }>(`/sites/${siteId}/email/test`, {
      method: 'POST',
      body: JSON.stringify({ to }),
    }),
  sendClientInvite: (siteId: string, to: string, agencyName?: string) =>
    request<{ ok: boolean }>(`/sites/${siteId}/email/invite`, {
      method: 'POST',
      body: JSON.stringify({ to, agencyName }),
    }),
  listMedia: (siteId: string) => request<MediaAsset[]>(`/sites/${siteId}/media`),
  getIntegrations: () =>
    request<{
      openrouter: boolean;
      anthropic: boolean;
      firecrawl: boolean;
      onpage_ai: boolean;
      vercel: boolean;
      originality_ai: boolean;
      defaultAiProvider: 'openrouter' | 'anthropic' | null;
      defaultAiModel: string | null;
      vercelTeamId: string | null;
      updatedAt: string | null;
    }>('/admin/integrations'),
  updateIntegrations: (body: {
    openrouter_api_key?: string | null;
    anthropic_api_key?: string | null;
    firecrawl_api_key?: string | null;
    onpage_ai_api_key?: string | null;
    vercel_token?: string | null;
    originality_ai_api_key?: string | null;
    defaultAiProvider?: 'openrouter' | 'anthropic' | null;
    defaultAiModel?: string | null;
    vercelTeamId?: string | null;
  }) =>
    request<Awaited<ReturnType<typeof api.getIntegrations>>>('/admin/integrations', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  listOpenRouterModels: () =>
    request<{ models: Array<{ id: string; name: string }> }>('/admin/openrouter/models'),
  listDesignThemes: () =>
    request<{ themes: Array<{ id: string; name: string; desc: string; aesthetic: string }> }>(
      '/design/themes'
    ),
  previewDesignTheme: (siteId: string, themeId: string) =>
    request<{ styleGuide: import('./components/design/ThemePreview').StyleGuidePreview }>(
      `/sites/${siteId}/design/preview/${themeId}`
    ),
  applyDesignTheme: (siteId: string, themeId: string) =>
    request<{ styleGuide: import('./components/design/ThemePreview').StyleGuidePreview }>(
      `/sites/${siteId}/design/apply`,
      {
      method: 'POST',
      body: JSON.stringify({ themeId }),
    }),
  getSiteStyleGuide: (siteId: string) =>
    request<{ styleGuide: Record<string, unknown> }>(`/sites/${siteId}/design`),
  listBlogSilos: (siteId: string) => request<BlogSilo[]>(`/sites/${siteId}/blog/silos`),
  createBlogPillar: (siteId: string, body: { keyword: string; slug: string; title: string }) =>
    request<{ pillar: BlogPillar; pillarPost: BlogPost }>(`/sites/${siteId}/blog/pillars`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createSupportivePost: (siteId: string, pillarId: string, body: { title: string; slug: string }) =>
    request<BlogPost>(`/sites/${siteId}/blog/pillars/${pillarId}/posts`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getBlogPost: (siteId: string, postId: string) =>
    request<BlogPost>(`/sites/${siteId}/blog/posts/${postId}`),
  updateBlogPost: (siteId: string, postId: string, body: Partial<BlogPost>) =>
    request<BlogPost>(`/sites/${siteId}/blog/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  listBlogSeoRecipes: (siteId: string, postId: string) =>
    request<{
      recipes: Array<{ id: string; number: number; title: string; description?: string }>;
      pageUrl: string;
      keyword: string;
    }>(`/sites/${siteId}/blog/posts/${postId}/seo-recipes`),
  detectBlogAi: (siteId: string, postId: string) =>
    request<{ score: number; provider: string; note?: string }>(
      `/sites/${siteId}/blog/posts/${postId}/detect-ai`,
      { method: 'POST' }
    ),
  humanizeBlogPost: (siteId: string, postId: string) =>
    request<{ humanizedHtml: string }>(`/sites/${siteId}/blog/posts/${postId}/humanize`, {
      method: 'POST',
    }),
  listRssFeeds: (siteId: string) =>
    request<Array<{ id: string; url: string; label: string }>>(`/sites/${siteId}/blog/rss-feeds`),
  addRssFeed: (siteId: string, url: string, label: string) =>
    request<{ id: string; url: string; label: string }>(`/sites/${siteId}/blog/rss-feeds`, {
      method: 'POST',
      body: JSON.stringify({ url, label }),
    }),
  listCampaigns: (siteId: string) =>
    request<Array<{ id: string; name: string; status: string; keyword: string }>>(
      `/sites/${siteId}/campaigns`
    ),
  createCampaign: (siteId: string, pillarId: string) =>
    request<{
      campaign: { id: string; name: string };
      steps: Array<{ subject: string; previewText: string; delayDays: number }>;
    }>(`/sites/${siteId}/campaigns`, { method: 'POST', body: JSON.stringify({ pillarId }) }),
  getCampaign: (siteId: string, campaignId: string) =>
    request<{
      campaign: { id: string; name: string };
      steps: Array<{ subject: string; previewText: string; delayDays: number }>;
    }>(`/sites/${siteId}/campaigns/${campaignId}`),
  activateCampaign: (siteId: string, campaignId: string) =>
    request<{ campaign: { id: string }; automationId?: string }>(
      `/sites/${siteId}/campaigns/${campaignId}/activate`,
      { method: 'POST' }
    ),
  getBlogSeoRecipe: (siteId: string, postId: string, recipeId: string) =>
    request<{ id: string; title: string; content: string; pageUrl: string; keyword: string }>(
      `/sites/${siteId}/blog/posts/${postId}/seo-recipes/${recipeId}`
    ),
};
