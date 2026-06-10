import { z } from 'zod';
import type { SiteEmailConfig } from '../storage/types.js';

export const ContactFormSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  message: z.string().min(1).max(5000),
  pagePath: z.string().max(500).optional(),
});

const SCRIPT_OR_HTML_PATTERN = /<script\b|javascript:|on\w+\s*=|<\/?[a-z][\s\S]*>/i;

export const EmailSettingsSchema = z.object({
  resendApiKey: z.string().min(10).optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(100).optional(),
  notifyEmail: z.string().email().optional(),
  successMessage: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
});

export const InviteEmailSchema = z.object({
  to: z.string().email(),
  agencyName: z.string().max(100).optional(),
});

export const TestEmailSchema = z.object({
  to: z.string().email(),
});

/** Deterministic validation for merged site email / form config */
export function validateEmailConfig(config: SiteEmailConfig): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.notifyEmail?.trim()) {
    const parsed = z.string().email().safeParse(config.notifyEmail.trim());
    if (!parsed.success) errors.push('Notification email must be valid');
  }

  if (config.successMessage?.trim()) {
    if (SCRIPT_OR_HTML_PATTERN.test(config.successMessage)) {
      errors.push('Success message must not contain scripts or HTML');
    }
  }

  if (config.enabled && !config.notifyEmail?.trim()) {
    errors.push('Notification email is required when the contact form is enabled');
  }

  return { ok: errors.length === 0, errors };
}
