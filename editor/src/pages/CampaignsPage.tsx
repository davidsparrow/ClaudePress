import { useCallback, useEffect, useState } from 'react';
import { api, type BlogSilo, type CampaignStep } from '../api';
import HumanizePanel from '../components/HumanizePanel';

interface Props {
  siteId: string;
}

export default function CampaignsPage({ siteId }: Props) {
  const [silos, setSilos] = useState<BlogSilo[]>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; status: string; keyword: string }>>([]);
  const [selected, setSelected] = useState<{
    campaign: { id: string; name: string; status?: string };
    steps: CampaignStep[];
  } | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
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
      setSelectedStepId(res.steps[0]?.id ?? null);
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
    setSelectedStepId(res.steps[0]?.id ?? null);
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
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {selected.steps.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    className={s.id === selectedStepId ? '' : 'secondary'}
                    onClick={() => setSelectedStepId(s.id)}
                  >
                    Email {i + 1}
                  </button>
                ))}
              </div>
              {selected.steps
                .filter((s) => s.id === selectedStepId)
                .map((s) => (
                  <div key={s.id}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                      Subject
                      <input
                        value={s.subject}
                        onChange={(e) => {
                          const subject = e.target.value;
                          setSelected((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  steps: prev.steps.map((st) =>
                                    st.id === s.id ? { ...st, subject } : st
                                  ),
                                }
                              : prev
                          );
                        }}
                        onBlur={() =>
                          void api.updateCampaignStep(siteId, selected.campaign.id, s.id, {
                            subject: s.subject,
                          })
                        }
                        style={{ width: '100%', marginTop: '0.25rem' }}
                      />
                    </label>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                      Preview text
                      <input
                        value={s.previewText}
                        onChange={(e) => {
                          const previewText = e.target.value;
                          setSelected((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  steps: prev.steps.map((st) =>
                                    st.id === s.id ? { ...st, previewText } : st
                                  ),
                                }
                              : prev
                          );
                        }}
                        onBlur={() =>
                          void api.updateCampaignStep(siteId, selected.campaign.id, s.id, {
                            previewText: s.previewText,
                          })
                        }
                        style={{ width: '100%', marginTop: '0.25rem' }}
                      />
                    </label>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                      Body HTML
                      <textarea
                        rows={8}
                        value={s.bodyHtml}
                        onChange={(e) => {
                          const bodyHtml = e.target.value;
                          setSelected((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  steps: prev.steps.map((st) =>
                                    st.id === s.id ? { ...st, bodyHtml } : st
                                  ),
                                }
                              : prev
                          );
                        }}
                        onBlur={() =>
                          void api.updateCampaignStep(siteId, selected.campaign.id, s.id, {
                            bodyHtml: s.bodyHtml,
                          })
                        }
                        style={{ width: '100%', marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.85rem' }}
                      />
                    </label>
                    <p className="dash-page__muted">
                      Wait {s.delayDays} day{s.delayDays === 1 ? '' : 's'} after previous email
                    </p>
                    <HumanizePanel
                      siteId={siteId}
                      contentHtml={s.bodyHtml}
                      contentType="email"
                      humanizeTarget={{
                        kind: 'campaign',
                        campaignId: selected.campaign.id,
                        stepId: s.id,
                      }}
                      onAccept={(html) => {
                        setSelected((prev) =>
                          prev
                            ? {
                                ...prev,
                                steps: prev.steps.map((st) =>
                                  st.id === s.id ? { ...st, bodyHtml: html } : st
                                ),
                              }
                            : prev
                        );
                        void api.updateCampaignStep(siteId, selected.campaign.id, s.id, {
                          bodyHtml: html,
                        });
                      }}
                    />
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
