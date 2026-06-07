export interface ContentSlot {
  id: string;
  type: 'text' | 'image' | 'link' | 'button';
  value: string;
  href?: string;
  alt?: string;
  tag: string;
  path: string;
}

export interface PageContent {
  template: string;
  slots: Record<string, ContentSlot>;
  slotOrder: string[];
}

export interface SitePage {
  id: string;
  path: string;
  title: string;
  sourceUrl?: string;
  content: PageContent;
  updatedAt: string;
}

export interface SiteMeta {
  id: string;
  name: string;
  domain?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  meta: SiteMeta;
  pages: SitePage[];
}

export interface SlotChange {
  slotId: string;
  value?: string;
  href?: string;
  alt?: string;
}

export interface SiteVersion {
  id: string;
  label: string;
  createdAt: string;
}
