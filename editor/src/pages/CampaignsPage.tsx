import { useCallback, useEffect, useState } from 'react';
import { api, type BlogSilo } from '../api';

interface Props {
  siteId: string;
}

export default function CampaignsPage({ siteId }: Props) {
  const [silos, setSilos] = useState<BlogSilo[]>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; status: string; keyword: string }>>([]);
  const [selected, setSelected] = useState<{ campaign: { id: string; name: string }; steps: Array<{ subject: string; previewText: string; delayDays: number }> } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    api.listBlogSilos(siteId).then(setSilos);
    api.listCampaigns(siteId).then(setCampaigns).catch(() => setCampaigns([]));
  }, [siteId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createFromPillar(pillarId: string) {
    setLoading(true);
    setError('');
    try {
      const res = await api.createCampaign(siteId, pillarId);
      setSelected({ campaign: res.campaign, steps: res.steps });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  }

  async function openCampaign(id: string) {
    const res = await api.getCampaign(siteId, id);
    setSelected({ campaign: res.campaign, steps: res.steps });
  }

  async function activate(id: string) {
    setLoading(true);
    try {
      await api.activateCampaign(siteId, id);
      refresh();
      await openCampaign(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activate failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dash-page">
      <h2 className="dash-page__title">Campaigns</h2>
      <p className="dash-page__muted">Pillar-linked nurture sequences via Resend Automations.</p>
      {error && <p className="dash-page__error">{error}</p>}

      <div className="blog-page__layout">
        <aside>
          <h3 style={{ fontSize: '1rem' }}>Create from pillar</h3>
          {silos.map(({ pillar }) => (
            <button
              key={pillar.id}
              type="button"
              className="secondary"
              style={{ display: 'block', width: '100%', marginBottom: '0.5rem', textAlign: 'left' }}
              disabled={loading}
              onClick={() => void createFromPillar(pillar.id)}
            >
              {pillar.title}
            </button>
          ))}

          <h3 style={{ fontSize: '1rem', marginTop: '1rem' }}>Campaigns</h3>
          <ul className="blog-silo__posts">
            {campaigns.map((c) => (
              <li key={c.id}>
                <button type="button" className="blog-silo__post-btn" onClick={() => void openCampaign(c.id)}>
                  {c.name}
                  <span>{c.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main>
          {!selected && <p className="dash-page__muted">Create or select a campaign.</p>}
          {selected && (
            <div className="panel">
              <h3>{selected.campaign.name}</h3>
              {selected.steps.map((s, i) => (
                <div key={i} className="blog-silo" style={{ marginTop: '0.75rem' }}>
                  <strong>
                    Email {i + 1}
                    {s.delayDays > 0 ? ` — wait ${s.delayDays}d` : ''}
                  </strong>
                  <p>{s.subject}</p>
                  <p className="dash-page__muted">{s.previewText}</p>
                </div>
              ))}
              <button type="button" style={{ marginTop: '1rem' }} disabled={loading} onClick={() => void activate(selected.campaign.id)}>
                Activate in Resend
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
