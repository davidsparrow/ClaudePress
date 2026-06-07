export type SlotType = 'text' | 'image' | 'link' | 'button';

export interface ContentSlot {
  id: string;
  type: SlotType;
  value: string;
  href?: string;
  alt?: string;
  tag: string;
  /** Structural path used for stable IDs and section grouping */
  path: string;
}

export interface PageContent {
  /** Frozen HTML template with {{slot:id}} placeholders */
  template: string;
  slots: Record<string, ContentSlot>;
  /** Ordered slot IDs — used by Guardian to detect removed sections */
  slotOrder: string[];
}

export interface IngestResult {
  sourceUrl: string;
  pagePath: string;
  title: string;
  content: PageContent;
}

export interface SlotChange {
  slotId: string;
  value?: string;
  href?: string;
  alt?: string;
}

export interface GuardianResult {
  ok: boolean;
  errors: string[];
  applied?: Record<string, ContentSlot>;
}

export const SLOT_PLACEHOLDER_PREFIX = '{{slot:';
export const SLOT_PLACEHOLDER_SUFFIX = '}}';

export function slotPlaceholder(id: string): string {
  return `${SLOT_PLACEHOLDER_PREFIX}${id}${SLOT_PLACEHOLDER_SUFFIX}`;
}

export function parseSlotPlaceholder(text: string): string | null {
  const match = text.match(/^\{\{slot:([^}]+)\}\}$/);
  return match ? match[1] : null;
}
