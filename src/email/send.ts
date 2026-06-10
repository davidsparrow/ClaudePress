import { render } from '@react-email/render';
import { Resend } from 'resend';
import type { SiteEmailConfig, FormSubmission } from '../storage/types.js';
import {
  ClientInviteEmail,
  ContactNotificationEmail,
  TestEmail,
} from './templates.js';

export interface SendResult {
  id?: string;
  error?: string;
}

function fromAddress(config: SiteEmailConfig): string {
  const name = config.fromName?.trim() || 'PressPal';
  const email = config.fromEmail?.trim();
  if (!email) throw new Error('From email is required');
  return `${name} <${email}>`;
}

function requireConfig(config?: SiteEmailConfig): SiteEmailConfig {
  if (!config?.enabled || !config.resendApiKey?.trim()) {
    throw new Error('Email is not configured for this site — add your Resend API key');
  }
  if (!config.fromEmail?.trim()) {
    throw new Error('From email is required (use a verified domain in Resend)');
  }
  return config;
}

export async function sendTestEmail(
  config: SiteEmailConfig,
  siteName: string,
  to: string
): Promise<SendResult> {
  const cfg = requireConfig(config);
  const resend = new Resend(cfg.resendApiKey!.trim());
  const html = await render(TestEmail({ siteName }));

  const { data, error } = await resend.emails.send({
    from: fromAddress(cfg),
    to,
    subject: `PressPal email test — ${siteName}`,
    html,
  });

  if (error) return { error: error.message };
  return { id: data?.id };
}

export async function sendClientInvite(
  config: SiteEmailConfig,
  opts: { siteName: string; editorUrl: string; to: string; agencyName?: string }
): Promise<SendResult> {
  const cfg = requireConfig(config);
  const resend = new Resend(cfg.resendApiKey!.trim());
  const html = await render(
    ClientInviteEmail({
      siteName: opts.siteName,
      editorUrl: opts.editorUrl,
      agencyName: opts.agencyName,
    })
  );

  const { data, error } = await resend.emails.send({
    from: fromAddress(cfg),
    to: opts.to,
    subject: `Edit your site: ${opts.siteName}`,
    html,
  });

  if (error) return { error: error.message };
  return { id: data?.id };
}

export async function sendContactNotification(
  config: SiteEmailConfig,
  siteName: string,
  submission: FormSubmission
): Promise<SendResult | null> {
  const cfg = requireConfig(config);
  const to = cfg.notifyEmail?.trim() || cfg.fromEmail?.trim();
  if (!to) throw new Error('Notify email or from email is required');

  const resend = new Resend(cfg.resendApiKey!.trim());
  const html = await render(
    ContactNotificationEmail({
      siteName,
      name: submission.name,
      email: submission.email,
      message: submission.message,
      pagePath: submission.pagePath,
    })
  );

  const { data, error } = await resend.emails.send({
    from: fromAddress(cfg),
    to,
    replyTo: submission.email,
    subject: `Contact form: ${submission.name} — ${siteName}`,
    html,
  });

  if (error) return { error: error.message };
  return { id: data?.id };
}

export function maskApiKey(key?: string): string | undefined {
  if (!key) return undefined;
  if (key.length <= 8) return '••••••••';
  return `••••••••${key.slice(-4)}`;
}

export function buildContactFormSnippet(siteId: string, appUrl: string): string {
  const action = `${appUrl.replace(/\/$/, '')}/api/public/sites/${siteId}/contact`;
  return `<!-- PressPal contact form — posts to your PressPal server -->
<form action="${action}" method="POST">
  <input type="hidden" name="_format" value="json" />
  <label>Name <input type="text" name="name" required /></label>
  <label>Email <input type="email" name="email" required /></label>
  <label>Message <textarea name="message" required></textarea></label>
  <button type="submit">Send</button>
</form>`;
}

export function buildEditorUrl(siteId: string, appUrl: string): string {
  return `${appUrl.replace(/\/$/, '')}/editor/?site=${siteId}`;
}
