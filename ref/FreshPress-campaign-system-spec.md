# Email Campaign System — Architecture & Spec
> React CMS Platform · Blog Module Extension · v1.0
> Built entirely on Resend's native stack — no third-party campaign tools needed

---

## The Short Answer on That Code Snippet

The snippet you found is just `resend.emails.send()` wrapped in an API route — a single one-off email with no scheduling, no sequence state, no tracking, no stop logic, and no campaign management. It's the "Hello World" of Resend, essentially. **Don't build on it.**

The good news: **Resend launched native Automations on April 13, 2026** — literally weeks ago. It's a full event-triggered drip campaign system with a complete REST API, visual editor, conditions, delays, branching, and observability. It's exactly what you need and it's already in your stack. No Driplane, no Resendly, no third-party tool required.

---

## What Resend Now Gives You Natively

| Feature | Resend Capability | API Endpoint |
|---|---|---|
| Drip sequences with delays | ✅ Automations (April 2026) | `POST /automations` |
| Event-based triggers | ✅ Events API | `POST /events/send` |
| Email templates | ✅ Templates API | `POST /templates` |
| Stop a subscriber's sequence | ✅ Stop Automation | `POST /automations/{id}/stop` |
| Opened / clicked / bounced tracking | ✅ Webhooks | `email.opened`, `email.clicked`, `email.bounced` |
| Domain DKIM/SPF health status | ✅ Domains API | `GET /domains/{id}` |
| Inbound email (reply detection) | ✅ Receiving API (new) | `GET /emails/received` |
| Per-run observability | ✅ Automation Runs API | `GET /automations/{id}/runs` |

Reply detection may even be handlable entirely within Resend now via their new Receiving API — meaning MXroute IMAP polling may not be needed for the campaign auto-stop feature.

---

## 1. Campaign Architecture

### One Campaign = One Pillar Keyword

```
Pillar Keyword: "email marketing"
    │
    ├── Resend Event:      "lead.subscribed" (payload: { pillar_keyword: "email-marketing" })
    ├── Resend Automation: "Email Marketing — Lead Nurture"
    │       │
    │       ├── Step 1: Send immediately  → Email about Pillar Post (the big overview)
    │       ├── Wait: 2 days
    │       ├── Step 2: Send              → Email based on Supportive Post 1
    │       ├── Wait: 3 days
    │       ├── Step 3: Send              → Email based on Supportive Post 2
    │       ├── Wait: 4 days
    │       ├── Step 4: Send              → Email based on Supportive Post 3
    │       ├── Wait: 7 days
    │       └── Step 5: Send              → Soft CTA (offer, consultation, etc.)
    │
    └── Stop Trigger: "lead.replied" event → Resend Stop Automation API called immediately
```

### UTM Strategy — The Glue That Binds Blog to Campaign

Every blog post in a keyword silo shares the same UTM suffix:

```
Pillar Post:    yourdomain.com/blog/email-marketing-guide?utm_campaign=email-marketing
Supportive 1:   yourdomain.com/blog/email-subject-lines?utm_campaign=email-marketing  
Supportive 2:   yourdomain.com/blog/email-open-rates?utm_campaign=email-marketing
Supportive 3:   yourdomain.com/blog/email-automation-tools?utm_campaign=email-marketing
```

The embedded lead capture form on ALL of these posts fires the same Resend event with the same `pillar_keyword` in payload. It doesn't matter which post they found first — they land in the same nurture sequence.

The form has a hidden field that auto-populates from the URL param:
```html
<input type="hidden" name="pillar_keyword" value="email-marketing" />
```

On submit → CMS fires:
```typescript
await resend.events.send({
  event: 'lead.subscribed',
  email: subscriber.email,
  payload: {
    pillar_keyword: 'email-marketing',   // routes to correct automation
    first_name: subscriber.name,
    source_url: window.location.href,    // which post converted them
    utm_campaign: 'email-marketing',
  },
});
```

Resend Automation picks this up instantly and begins the sequence for that contact.

---

## 2. AI Pre-Draft System

When admin creates a new campaign, the system does the heavy lifting before a single email is written manually.

### Pre-Draft Flow

```
Admin clicks "Create Campaign" → selects Pillar Post Keyword
        ↓
System fetches: Pillar Post HTML content from DB
System fetches: All Supportive Post HTML content for that keyword silo
        ↓
BYOK API call (admin's OpenRouter key) with system prompt:
  "You are an email sequence writer. Given this blog content about [keyword],
   generate a [N]-email lead nurture sequence. Email 1 should be based on the 
   pillar content. Each subsequent email should be based on one supportive post.
   Final email should be a soft CTA. Format: JSON array of {subject, preview_text, body_html}"
        ↓
Returns: Draft sequence JSON
        ↓
Sequence editor opens pre-populated with all email drafts
Admin reviews, edits, runs AI detection per email, humanizes if needed
        ↓
Admin clicks "Create in Resend" → CMS calls Resend API to create Templates + Automation
        ↓
Campaign goes live
```

### What Gets Pre-Drafted Per Email
- Subject line (with keyword in position 1)
- Preview text (the grey text shown in inbox below subject)
- Full HTML body (structured: greeting → value → blog excerpt teaser → CTA link back to post)
- Suggested delay before this email (auto-calculated based on number of posts)

---

## 3. Sequence Editor UI

### Layout — Vertical Timeline (not a node graph — intentionally simple)

```
CAMPAIGN: "Email Marketing — Lead Nurture"
Status: [Draft]  Keyword: email-marketing  Subscribers: 0  [Activate] [Save]

┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚡ TRIGGER                                                                   │
│ Event: lead.subscribed  where  pillar_keyword = "email-marketing"            │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ immediately
┌───────────────────────────────────▼─────────────────────────────────────────┐
│ ✉ EMAIL 1                                                          [Edit]    │
│ Subject: The complete guide to email marketing (that nobody told you)        │
│ Preview: Most marketers get this backwards...                                │
│ Source: Pillar Post — "Email Marketing Guide"                                │
│ [🔍 AI Score: 71%]  [✍ Humanize]                                            │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ ⏱ Wait: 2 days  [edit delay]
┌───────────────────────────────────▼─────────────────────────────────────────┐
│ ✉ EMAIL 2                                                          [Edit]    │
│ Subject: Why your subject lines are getting ignored (and the fix)            │
│ Preview: I analyzed 200 subject lines last week and found...                 │
│ Source: Supportive Post — "Email Subject Lines"                              │
│ [🔍 AI Score: 44%]  [✍ Humanize]                                            │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ ⏱ Wait: 3 days  [edit delay]
                                   ...

[+ Add Email Step]
```

### Per-Email Edit Panel (opens as tab, same as blog editor)
- Same TipTap HTML editor used in blog posts — zero new learning curve
- Left sidebar: subject line, preview text, delay, from name, reply-to
- Same AI Detection button → same score gauge → same Detection Tab
- Same Humanize button → same diff view → same Accept/Discard flow
- "Save to Sequence" button (not "Publish" — keeps it in draft until whole campaign is activated)

---

## 4. Campaign Activation → Resend API Flow

When admin clicks "Activate Campaign":

```typescript
// 1. Create Resend Templates for each email step
const templateIds = await Promise.all(
  campaign.steps.map(step => 
    resend.templates.create({
      name: `${campaign.keyword} — Email ${step.order}`,
      subject: step.subject,
      html: step.body_html,
    })
  )
);

// 2. Build the Automation steps array
const automationSteps = [
  {
    key: 'trigger',
    type: 'trigger',
    config: { eventName: 'lead.subscribed' },
  },
  ...campaign.steps.flatMap((step, i) => [
    {
      key: `email_${i + 1}`,
      type: 'send_email',
      config: { template: { id: templateIds[i] } },
    },
    // Add wait step between emails (not after last)
    ...(i < campaign.steps.length - 1 ? [{
      key: `wait_${i + 1}`,
      type: 'delay',
      config: { duration: step.delay_days, unit: 'days' },
    }] : []),
  ]),
];

// 3. Create Automation in Resend
const automation = await resend.automations.create({
  name: `${campaign.keyword} — Lead Nurture`,
  status: 'enabled',
  steps: automationSteps,
  connections: buildConnectionGraph(automationSteps), // helper fn
});

// 4. Store automation ID in our DB for management
await db.campaigns.update({ 
  id: campaign.id, 
  resend_automation_id: automation.id,
  status: 'active',
  activated_at: new Date(),
});
```

---

## 5. Reply Detection → Auto-Stop

### Approach A — Resend Receiving API (Preferred, newer)
Resend now has inbound email receiving. Configure the campaign `reply-to` as `replies@yourdomain.com`, add the MX record for Resend receiving, and poll `GET /emails/received` for new messages. When a reply arrives from a known subscriber:

```typescript
// Scheduled check every 5 minutes (Vercel Cron)
const received = await resend.emails.listReceived({ to: 'replies@yourdomain.com' });

for (const email of received.data) {
  const subscriber = await db.subscribers.findByEmail(email.from);
  if (subscriber?.active_campaign_id) {
    // Stop the Resend Automation for this contact
    await resend.automations.stop(subscriber.resend_automation_id, {
      email: subscriber.email,
    });
    
    // Update our DB
    await db.campaign_subscribers.update({
      subscriber_id: subscriber.id,
      status: 'stopped_by_reply',
      stopped_at: new Date(),
      reply_preview: email.text?.slice(0, 200),
    });
  }
}
```

### Approach B — MXroute IMAP Bridge (Fallback)
If Resend receiving doesn't suit the domain setup (e.g., MXroute already owns the MX records), use the existing email sync system to monitor a dedicated `replies@` MXroute mailbox — same concept, different polling source. Both approaches call the same `resend.automations.stop()` at the end.

---

## 6. Campaign Dashboard UI

### Tab Structure in Email Section

```
[ Campaigns ]  [ Sent Activity ]  [ Domain Health ]  [ Subscribers ]
```

### Campaigns Tab

```
 CAMPAIGNS                                        [+ New Campaign]

 Filter: [All ▾]  [Active ▾]  [Keyword ▾]

 Name                    Keyword          Status     Enrolled  Opened   Replied  Last Send
 ──────────────────────────────────────────────────────────────────────────────────────────
 Email Marketing Nurture  email-marketing  ● Active   142       61%      8        Jun 5
 SEO for Solopreneurs     seo-basics       ● Active   89        54%      5        Jun 7
 Website Launch Guide     website-launch   ◌ Draft    —         —        —        —
 Social Media Strategy    social-media     ◉ Paused   67        49%      12       May 28
 ──────────────────────────────────────────────────────────────────────────────────────────
```

Click any row → opens Campaign Detail with the sequence editor + per-step analytics.

### Sent Activity Tab

Real-time feed of individual email sends, pulled from Resend webhooks stored in DB:

```
 SENT ACTIVITY                              Search: [____________]  Filter: [All ▾]

 Time      Campaign               Subscriber              Subject              Opened  Clicked  Status
 ─────────────────────────────────────────────────────────────────────────────────────────────────────
 2:41 PM   Email Marketing        sarah@client.com        "The complete guide…"  ✓       ✓       Delivered
 2:38 PM   SEO for Solopreneurs   mike@startup.io         "Why your rankings…"   ✓       —       Delivered
 1:15 PM   Email Marketing        john@company.com        "The complete guide…"  —       —       Delivered
 Yesterday  Social Media          emma@brand.co           "3 posts that changed…" —      —       Bounced ⚠
 ─────────────────────────────────────────────────────────────────────────────────────────────────────
```

Row color coding:
- **Green row**: Opened + Clicked (engaged)
- **Blue row**: Reply received → sequence auto-stopped
- **Yellow row**: Opened only
- **Default**: Delivered, no open yet (within 48hr window)
- **Red row**: Bounced or Complained

Clicking a row expands to show: full send details, which step in sequence, timestamp chain.

### Domain Health Tab

```
 DOMAIN HEALTH                                               Last checked: 2 min ago  [↻ Recheck]

 yourdomain.com
 ┌──────────────────┬────────────────────────────────────────────────────────────────┐
 │ SENDING (Resend) │                                                                │
 ├──────────────────┤                                                                │
 │ SPF       ✓      │ v=spf1 include:_spf.resend.com ~all                           │
 │ DKIM      ✓      │ resend._domainkey.yourdomain.com — Valid, expires never        │
 │ DMARC     ✓      │ p=quarantine; rua=mailto:dmarc@yourdomain.com                 │
 │ Status    ✓      │ Verified — All sending records valid                           │
 ├──────────────────┤                                                                │
 │ RECEIVING        │                                                                │
 │ (MXroute)        │                                                                │
 ├──────────────────┤                                                                │
 │ MX        ✓      │ mail.mxroute.com (priority 10)                                │
 │ IMAP      ✓      │ Connected — 3 active mailboxes                                │
 └──────────────────┴────────────────────────────────────────────────────────────────┘

 ⚠ DMARC policy is set to "quarantine" — consider upgrading to "reject" once you've
   confirmed all sending is verified. [Learn more]
```

Domain health data sourced from:
- `GET /domains/{id}` Resend API → SPF, DKIM, DMARC status
- MXroute IMAP connection test → MX + connection health
- CMS runs verification check on page load + on-demand

### Subscribers Tab

```
 SUBSCRIBERS                                              Total: 847   [Export CSV]

 Email                   Subscribed    Campaign                 Step        Status
 ──────────────────────────────────────────────────────────────────────────────────
 sarah@client.com        Jun 3         Email Marketing           Complete   ✓ Finished
 mike@startup.io         Jun 5         SEO Solopreneurs          Step 2     → Active
 john@company.com        Jun 7         Email Marketing           Step 1     → Active
 emma@brand.co           May 28        Social Media              —          ⚠ Bounced
 ──────────────────────────────────────────────────────────────────────────────────
```

---

## 7. Database Schema — Campaign System

```sql
-- One campaign per Pillar Post keyword
CREATE TABLE email_campaigns (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id                 UUID REFERENCES sites(id),
  pillar_keyword          TEXT NOT NULL,
  pillar_post_id          UUID REFERENCES blog_posts(id),
  name                    TEXT NOT NULL,
  from_name               TEXT,
  from_email              TEXT,
  reply_to_email          TEXT,                 -- monitored mailbox for auto-stop
  status                  TEXT DEFAULT 'draft', -- draft|active|paused|archived
  resend_automation_id    TEXT,                 -- set after activation
  utm_campaign            TEXT,                 -- slug: 'email-marketing'
  activated_at            TIMESTAMPTZ,
  last_send_at            TIMESTAMPTZ,
  total_enrolled          INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- Email steps in the sequence
CREATE TABLE campaign_steps (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID REFERENCES email_campaigns(id),
  step_order           INTEGER NOT NULL,
  source_post_id       UUID REFERENCES blog_posts(id), -- which post this was drafted from
  subject              TEXT NOT NULL,
  preview_text         TEXT,
  body_html            TEXT NOT NULL,
  delay_days           INTEGER DEFAULT 0,       -- 0 = send immediately
  resend_template_id   TEXT,                    -- set after activation
  ai_score             NUMERIC(5,2),            -- last AI detection score
  ai_score_checked_at  TIMESTAMPTZ,
  humanized            BOOLEAN DEFAULT false,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- Individual subscribers enrolled in a campaign
CREATE TABLE campaign_subscribers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID REFERENCES email_campaigns(id),
  email                TEXT NOT NULL,
  first_name           TEXT,
  source_url           TEXT,                    -- which blog post captured them
  utm_source           TEXT,
  enrolled_at          TIMESTAMPTZ DEFAULT now(),
  current_step         INTEGER DEFAULT 1,
  status               TEXT DEFAULT 'active',   -- active|complete|stopped_by_reply|bounced|unsubscribed
  stopped_at           TIMESTAMPTZ,
  stop_reason          TEXT,
  reply_preview        TEXT,                    -- first 200 chars of reply if stopped by reply
  UNIQUE(campaign_id, email)
);

-- Email event log (populated by Resend webhooks)
CREATE TABLE campaign_email_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id   UUID REFERENCES campaign_subscribers(id),
  campaign_id     UUID REFERENCES email_campaigns(id),
  step_id         UUID REFERENCES campaign_steps(id),
  resend_email_id TEXT,
  event_type      TEXT NOT NULL,  -- sent|delivered|opened|clicked|bounced|complained|unsubscribed
  occurred_at     TIMESTAMPTZ DEFAULT now(),
  metadata        JSONB          -- click URL, bounce reason, etc.
);
```

---

## 8. Resend Webhook Handler

Resend fires webhooks for every email event. One handler catches them all:

```typescript
// app/api/webhooks/resend/route.ts
export async function POST(req: Request) {
  const event = await req.json();
  const { type, data } = event;

  // Map Resend event to our subscriber record
  const subscriber = await db.campaign_subscribers.findByEmail(data.to[0]);
  if (!subscriber) return new Response('OK', { status: 200 }); // not a campaign email

  const step = await db.campaign_steps.findByResendTemplateId(data.template_id);

  // Log event
  await db.campaign_email_events.create({
    subscriber_id: subscriber.id,
    campaign_id: subscriber.campaign_id,
    step_id: step?.id,
    resend_email_id: data.email_id,
    event_type: type.replace('email.', ''), // 'email.opened' → 'opened'
    occurred_at: new Date(data.created_at),
    metadata: { url: data.click?.url, reason: data.bounce?.reason },
  });

  // Handle bounce → mark subscriber
  if (type === 'email.bounced' || type === 'email.complained') {
    await db.campaign_subscribers.update({
      id: subscriber.id,
      status: type === 'email.bounced' ? 'bounced' : 'complained',
      stopped_at: new Date(),
    });
  }

  return new Response('OK', { status: 200 });
}
```

---

## 9. Lead Capture Form (on Blog Posts)

Each blog post in a keyword silo renders an embedded capture form. The admin defines the form appearance in the Campaign editor, and it auto-inserts into all posts linked to that keyword.

```typescript
// components/blog/LeadCaptureForm.tsx
// Inserted automatically into Pillar and Supportive posts

export function LeadCaptureForm({ pillarKeyword, campaignId }: Props) {
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    
    await fetch('/api/campaigns/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        email: formData.email,
        firstName: formData.firstName,
        pillarKeyword,
        sourceUrl: window.location.href,
        utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign'),
      }),
    });
    
    // Optimistic UI: show thank you message
    setSubmitted(true);
  }
  // ...
}
```

On the server:
```typescript
// app/api/campaigns/subscribe/route.ts
export async function POST(req: Request) {
  const { email, firstName, pillarKeyword, sourceUrl } = await req.json();
  
  // 1. Add to Resend Audience
  await resend.contacts.create({ audienceId: AUDIENCE_ID, email, firstName });
  
  // 2. Store in our DB
  const sub = await db.campaign_subscribers.create({ email, firstName, pillarKeyword, sourceUrl });
  
  // 3. Fire Resend event → triggers Automation
  await resend.events.send({
    event: 'lead.subscribed',
    email,
    payload: { pillar_keyword: pillarKeyword, first_name: firstName },
  });
  
  return Response.json({ success: true });
}
```

---

## 10. Build Checklist — Campaign System

### Phase 1: Data Foundation
- [ ] DB migrations: `email_campaigns`, `campaign_steps`, `campaign_subscribers`, `campaign_email_events`
- [ ] Resend Webhook handler (`/api/webhooks/resend`)
- [ ] Campaign CRUD API routes

### Phase 2: AI Pre-Draft
- [ ] Blog content scraper (reads Pillar + Supportive posts from DB)
- [ ] BYOK pre-draft API call + response parser
- [ ] Draft storage in `campaign_steps`

### Phase 3: Sequence Editor UI
- [ ] Campaign list view
- [ ] Sequence editor (vertical timeline)
- [ ] Per-step TipTap editor (reuse blog editor component)
- [ ] AI Detection + Humanize buttons (reuse blog module components)
- [ ] Delay editor per step

### Phase 4: Campaign Activation
- [ ] Resend Templates creation on activate
- [ ] Resend Automations creation on activate
- [ ] DB update with `resend_automation_id`

### Phase 5: Lead Capture
- [ ] `LeadCaptureForm` component
- [ ] Subscribe API route (Resend contact + event fire)
- [ ] Auto-insert form into blog posts by keyword silo

### Phase 6: Dashboard
- [ ] Campaigns tab (list + stats)
- [ ] Sent Activity tab (webhook events feed)
- [ ] Domain Health tab (Resend Domains API + MXroute status)
- [ ] Subscribers tab

### Phase 7: Reply Auto-Stop
- [ ] Resend Receiving API polling (or MXroute IMAP fallback)
- [ ] Reply → stop automation logic
- [ ] DB update: `status = 'stopped_by_reply'`

---

## What the Solopreneur Buyer Actually Experiences

From their perspective, the entire system is:

1. Write a blog (already done) → Campaign auto-drafted from blog content
2. Review 5 emails, tweak a few words, click Activate
3. Share blog link (UTM auto-added by CMS)
4. Leads subscribe → sequence runs automatically
5. Someone replies → sequence stops, their inbox gets it

That's the entire mental model they need to hold. Everything else is invisible.

---

*Resend pricing note: Automations are billed per Run. As of launch, 10,000 runs/month are included free. At MVP scale (solopreneur, hundreds of subscribers), this is likely free or near-free. Verify current pricing at resend.com/pricing#automations before quoting to clients.*
