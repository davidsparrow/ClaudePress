export type CampaignStatus = 'draft' | 'active' | 'paused';

export interface EmailCampaign {
  id: string;
  siteId: string;
  pillarId: string;
  keyword: string;
  name: string;
  status: CampaignStatus;
  resendAutomationId?: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
}

export interface CampaignStep {
  id: string;
  campaignId: string;
  siteId: string;
  order: number;
  subject: string;
  previewText: string;
  bodyHtml: string;
  delayDays: number;
  sourcePostId?: string;
  createdAt: string;
  updatedAt: string;
}
