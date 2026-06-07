import { describe, it, expect } from 'vitest';
import { ContactFormSchema, EmailSettingsSchema } from '../email/validate.js';
import { maskApiKey } from '../email/send.js';

describe('email validation', () => {
  it('validates contact form', () => {
    const result = ContactFormSchema.safeParse({
      name: 'Jane',
      email: 'jane@example.com',
      message: 'Hello',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email settings', () => {
    expect(EmailSettingsSchema.safeParse({ fromEmail: 'not-an-email' }).success).toBe(false);
  });

  it('masks api keys', () => {
    expect(maskApiKey('re_1234567890abcdef')).toBe('••••••••cdef');
  });
});
