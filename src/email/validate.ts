import { z } from 'zod';

export const ContactFormSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  message: z.string().min(1).max(5000),
  pagePath: z.string().max(500).optional(),
});

export const EmailSettingsSchema = z.object({
  resendApiKey: z.string().min(10).optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(100).optional(),
  notifyEmail: z.string().email().optional(),
  enabled: z.boolean().optional(),
});

export const InviteEmailSchema = z.object({
  to: z.string().email(),
  agencyName: z.string().max(100).optional(),
});

export const TestEmailSchema = z.object({
  to: z.string().email(),
});
