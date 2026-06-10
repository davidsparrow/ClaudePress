import { useEffect, useState } from 'react';
import { api } from '../api';

interface Props {
  siteId: string;
}

export default function SiteEmailDelivery({ siteId }: Props) {
  const [resendApiKey, setResendApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [apiKeyPreview, setApiKeyPreview] = useState<string | undefined>();
  const [testTo, setTestTo] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getEmailSettings(siteId)
      .then((data) => {
        setFromEmail(data.settings.fromEmail ?? '');
        setFromName(data.settings.fromName ?? '');
        setApiKeyPreview(data.settings.apiKeyPreview);
      })
      .catch((e) => setError(e.message));
  }, [siteId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('Saving…');
    try {
      const body: Record<string, string> = {
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
      };
      if (resendApiKey.trim()) body.resendApiKey = resendApiKey.trim();

      const data = await api.updateEmailSettings(siteId, body);
      setApiKeyPreview(data.settings.hasApiKey ? '••••••••' : undefined);
      setResendApiKey('');
      setStatus('Email delivery settings saved');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setStatus('');
    }
  }

  async function sendTest() {
    if (!testTo.trim()) return;
    setError('');
    setStatus('Sending test…');
    try {
      await api.sendTestEmail(siteId, testTo.trim());
      setStatus('Test email sent');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
      setStatus('');
    }
  }

  return (
    <div>
      <h3>Email delivery</h3>
      <p className="dash-page__muted">
        Per-site Resend configuration (BYOK). Form behavior is managed in <strong>Forms</strong>.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {status && <p className="status-ok">{status}</p>}

      <form onSubmit={save} style={{ marginTop: '0.75rem' }}>
        {apiKeyPreview && (
          <p className="hint" style={{ marginBottom: '0.75rem' }}>
            Current API key: {apiKeyPreview}
          </p>
        )}
        <div className="form-group">
          <label>Resend API key</label>
          <input
            type="password"
            value={resendApiKey}
            onChange={(e) => setResendApiKey(e.target.value)}
            placeholder="re_… (leave blank to keep existing)"
          />
        </div>
        <div className="form-group">
          <label>From email (verified in Resend)</label>
          <input
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="hello@yourdomain.com"
          />
        </div>
        <div className="form-group">
          <label>From name</label>
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your Agency" />
        </div>
        <button type="submit">Save delivery settings</button>
      </form>

      <div style={{ marginTop: '1rem' }}>
        <div className="form-group">
          <label>Send test email to</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
            <button type="button" className="secondary" onClick={sendTest}>
              Send test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
