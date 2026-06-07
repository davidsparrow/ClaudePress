import { useEffect, useState } from 'react';
import { getToken } from '../api';

interface EmailSettings {
  enabled: boolean;
  fromEmail?: string;
  fromName?: string;
  notifyEmail?: string;
  hasApiKey?: boolean;
  apiKeyPreview?: string;
}

interface FormSubmission {
  id: string;
  name: string;
  email: string;
  message: string;
  pagePath?: string;
  createdAt: string;
}

interface Props {
  siteId: string;
  siteName: string;
  onClose: () => void;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? 'Request failed');
  }
  return res.json();
}

export default function EmailSettingsPanel({ siteId, siteName, onClose }: Props) {
  const [settings, setSettings] = useState<EmailSettings>({ enabled: false });
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [resendApiKey, setResendApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [inviteTo, setInviteTo] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [editorUrl, setEditorUrl] = useState('');
  const [contactSnippet, setContactSnippet] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<{ settings: EmailSettings; editorUrl: string; contactFormSnippet: string }>(
        `/api/sites/${siteId}/email`
      ),
      apiFetch<FormSubmission[]>(`/api/sites/${siteId}/submissions`),
    ])
      .then(([emailData, subs]) => {
        setSettings(emailData.settings);
        setFromEmail(emailData.settings.fromEmail ?? '');
        setFromName(emailData.settings.fromName ?? '');
        setNotifyEmail(emailData.settings.notifyEmail ?? '');
        setEnabled(!!emailData.settings.enabled);
        setEditorUrl(emailData.editorUrl);
        setContactSnippet(emailData.contactFormSnippet);
        setSubmissions(subs);
      })
      .catch((e) => setError(e.message));
  }, [siteId]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('Saving…');
    try {
      const body: Record<string, unknown> = {
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
        notifyEmail: notifyEmail.trim(),
        enabled,
      };
      if (resendApiKey.trim()) body.resendApiKey = resendApiKey.trim();

      const data = await apiFetch<{ settings: EmailSettings }>(`/api/sites/${siteId}/email`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setSettings(data.settings);
      setResendApiKey('');
      setStatus('Settings saved');
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
      await apiFetch(`/api/sites/${siteId}/email/test`, {
        method: 'POST',
        body: JSON.stringify({ to: testTo.trim() }),
      });
      setStatus('Test email sent');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
      setStatus('');
    }
  }

  async function sendInvite() {
    if (!inviteTo.trim()) return;
    setError('');
    setStatus('Sending invite…');
    try {
      await apiFetch(`/api/sites/${siteId}/email/invite`, {
        method: 'POST',
        body: JSON.stringify({ to: inviteTo.trim(), agencyName: agencyName.trim() || undefined }),
      });
      setStatus('Invite sent');
      setTimeout(() => setStatus(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
      setStatus('');
    }
  }

  async function copySnippet() {
    await navigator.clipboard.writeText(contactSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="seo-panel">
      <div className="seo-panel-header">
        <div>
          <h2>Email — {siteName}</h2>
          <p className="hint">
            Use your own{' '}
            <a href="https://resend.com" target="_blank" rel="noreferrer">
              Resend
            </a>{' '}
            account. React Email templates built in.
          </p>
        </div>
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {status && <p className="status-ok">{status}</p>}

      <form onSubmit={saveSettings} className="panel" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Resend settings</h3>
        {settings.apiKeyPreview && (
          <p className="hint" style={{ marginBottom: '0.75rem' }}>
            Current API key: {settings.apiKeyPreview}
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
          <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="hello@yourdomain.com" />
        </div>
        <div className="form-group">
          <label>From name</label>
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your Agency" />
        </div>
        <div className="form-group">
          <label>Notify email (contact form inbox)</label>
          <input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} placeholder="you@agency.com" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable email for this site
        </label>
        <button type="submit">Save settings</button>
      </form>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Test & invite</h3>
        <div className="form-group">
          <label>Send test email to</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
            <button type="button" className="secondary" onClick={sendTest}>
              Send test
            </button>
          </div>
        </div>
        <div className="form-group">
          <label>Client editor invite</label>
          <input value={inviteTo} onChange={(e) => setInviteTo(e.target.value)} placeholder="client@example.com" />
        </div>
        <div className="form-group">
          <label>Agency name (optional)</label>
          <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Acme Web Studio" />
        </div>
        <button type="button" onClick={sendInvite}>Email client invite</button>
        {editorUrl && (
          <p className="hint" style={{ marginTop: '0.75rem' }}>
            Editor link: {editorUrl}
          </p>
        )}
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Contact form snippet</h3>
          <button type="button" className="secondary" onClick={copySnippet}>
            {copied ? '✓ Copied' : '⎘ Copy HTML'}
          </button>
        </div>
        <pre className="seo-prompt-content" style={{ maxHeight: '160px' }}>
          {contactSnippet || 'Save settings to generate snippet…'}
        </pre>
      </div>

      <div className="panel">
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>
          Form submissions ({submissions.length})
        </h3>
        {submissions.length === 0 ? (
          <p className="hint">No submissions yet.</p>
        ) : (
          <ul className="slot-list">
            {submissions.slice(0, 10).map((s) => (
              <li key={s.id} className="slot-item" style={{ cursor: 'default' }}>
                <div>
                  <strong>{s.name}</strong> — {s.email}
                </div>
                <div className="tag">{new Date(s.createdAt).toLocaleString()}</div>
                <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{s.message.slice(0, 120)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
