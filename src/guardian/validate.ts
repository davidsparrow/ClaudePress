import { z } from 'zod';
import type { ContentSlot, GuardianResult, PageContent, SlotChange } from '../content/types.js';
import { applySlotChanges } from '../content/render.js';
import { extractTemplateSlotIds } from '../ingest/index.js';

const SlotChangeSchema = z.object({
  slotId: z.string().min(1),
  value: z.string().optional(),
  href: z.string().optional(),
  alt: z.string().optional(),
});

const ChangesSchema = z.array(SlotChangeSchema).min(1);

/** Dangerous patterns that must never appear in slot values */
const SCRIPT_PATTERN = /<script\b|javascript:|on\w+\s*=/i;
const TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

/**
 * The Guardian — deterministic validator (no AI).
 * Rejects malformed changes and anything that would remove structural sections.
 */
export function validateChanges(
  content: PageContent,
  changes: SlotChange[]
): GuardianResult {
  const errors: string[] = [];

  const parsed = ChangesSchema.safeParse(changes);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.errors.map((e) => e.message) };
  }

  const templateSlotIds = new Set(extractTemplateSlotIds(content));
  const patch: Record<string, Partial<Pick<ContentSlot, 'value' | 'href' | 'alt'>>> = {};

  for (const change of parsed.data) {
    const slot = content.slots[change.slotId];
    if (!slot) {
      errors.push(`Unknown slot: ${change.slotId}`);
      continue;
    }
    if (!templateSlotIds.has(change.slotId)) {
      errors.push(`Slot ${change.slotId} is not in the frozen template`);
      continue;
    }

    const slotErrors = validateSingleChange(slot, change);
    errors.push(...slotErrors);

    if (slotErrors.length === 0) {
      patch[change.slotId] = {
        ...(change.value !== undefined ? { value: change.value } : {}),
        ...(change.href !== undefined ? { href: change.href } : {}),
        ...(change.alt !== undefined ? { alt: change.alt } : {}),
      };
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const next = applySlotChanges(content, patch);
  const sectionErrors = validateStructuralIntegrity(content, next);
  if (sectionErrors.length > 0) {
    return { ok: false, errors: sectionErrors };
  }

  return { ok: true, errors: [], applied: next.slots };
}

function validateSingleChange(slot: ContentSlot, change: SlotChange): string[] {
  const errors: string[] = [];

  if (change.value !== undefined) {
    if (typeof change.value !== 'string') {
      errors.push(`Slot ${change.slotId}: value must be a string`);
    } else if (SCRIPT_PATTERN.test(change.value)) {
      errors.push(`Slot ${change.slotId}: value contains disallowed script content`);
    } else if (slot.type !== 'text' && TAG_PATTERN.test(change.value)) {
      errors.push(`Slot ${change.slotId}: HTML tags are not allowed in ${slot.type} values`);
    } else if (slot.type === 'text' && TAG_PATTERN.test(change.value)) {
      errors.push(`Slot ${change.slotId}: raw HTML is not allowed in text slots`);
    } else if (isStructuralSlot(slot) && change.value.trim().length === 0) {
      errors.push(`Slot ${change.slotId}: cannot empty a structural text slot`);
    }
  }

  if (change.href !== undefined) {
    if (slot.type !== 'link') {
      errors.push(`Slot ${change.slotId}: href is only valid for link slots`);
    } else if (!isValidHref(change.href)) {
      errors.push(`Slot ${change.slotId}: invalid href "${change.href}"`);
    }
  }

  if (change.alt !== undefined && slot.type !== 'image') {
    errors.push(`Slot ${change.slotId}: alt is only valid for image slots`);
  }

  if (change.value === undefined && change.href === undefined && change.alt === undefined) {
    errors.push(`Slot ${change.slotId}: no changes provided`);
  }

  return errors;
}

/** Structural slots are headings and primary section labels — must not be emptied */
function isStructuralSlot(slot: ContentSlot): boolean {
  return /^h[1-6]$/.test(slot.tag) || slot.path.split('>').length <= 2;
}

function isValidHref(href: string): boolean {
  if (href.startsWith('/') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return true;
  }
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Ensure no template slot loses its content or disappears */
function validateStructuralIntegrity(before: PageContent, after: PageContent): string[] {
  const errors: string[] = [];
  const templateIds = extractTemplateSlotIds(before);

  for (const id of templateIds) {
    const prev = before.slots[id];
    const next = after.slots[id];

    if (!next) {
      errors.push(`Structural violation: slot ${id} was removed`);
      continue;
    }

    if (prev && isStructuralSlot(prev) && next.value.trim().length === 0) {
      errors.push(`Structural violation: slot ${id} (${prev.tag}) cannot be emptied`);
    }
  }

  if (after.slotOrder.length !== before.slotOrder.length) {
    errors.push('Structural violation: slot order changed — sections cannot be removed');
  }

  return errors;
}

export function mergeValidatedSlots(
  content: PageContent,
  applied: Record<string, ContentSlot>
): PageContent {
  return { ...content, slots: { ...content.slots, ...applied } };
}
