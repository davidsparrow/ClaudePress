import type { PageContent, ContentSlot } from './types.js';
import { slotPlaceholder } from './types.js';

/** Render frozen template + slot values into final HTML */
export function renderPage(content: PageContent): string {
  let html = content.template;

  for (const [id, slot] of Object.entries(content.slots)) {
    const placeholder = slotPlaceholder(id);
    const rendered = renderSlot(slot);
    html = html.split(placeholder).join(rendered);
  }

  return html;
}

function renderSlot(slot: ContentSlot): string {
  switch (slot.type) {
    case 'image':
      return `<img src="${escapeAttr(slot.value)}" alt="${escapeAttr(slot.alt ?? '')}" data-slot-id="${escapeAttr(slot.id)}" />`;
    case 'link':
      return `<a href="${escapeAttr(slot.href ?? '#')}" data-slot-id="${escapeAttr(slot.id)}">${escapeHtml(slot.value)}</a>`;
    case 'button':
      return `<button type="button" data-slot-id="${escapeAttr(slot.id)}">${escapeHtml(slot.value)}</button>`;
    case 'text':
    default:
      return escapeHtml(slot.value);
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

/** Apply validated slot updates immutably */
export function applySlotChanges(
  content: PageContent,
  changes: Record<string, Partial<Pick<ContentSlot, 'value' | 'href' | 'alt'>>>
): PageContent {
  const slots = { ...content.slots };

  for (const [slotId, patch] of Object.entries(changes)) {
    const existing = slots[slotId];
    if (!existing) continue;
    slots[slotId] = { ...existing, ...patch };
  }

  return { ...content, slots };
}
