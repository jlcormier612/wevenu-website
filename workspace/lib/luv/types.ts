/**
 * Project 7 / Program 5 — Luv for Internal Teams.
 * Suggestions-first Chief of Staff — not a chatbot.
 */

export type LuvSeverity = "info" | "suggested" | "attention" | "urgent";

export type LuvInsightType =
  | "walkthrough_followup"
  | "positive_reply"
  | "opportunity"
  | "support_improving"
  | "support_open"
  | "renewal_checkin"
  | "welcome_back"
  | "welcome_missing"
  | "white_glove_kickoff"
  | "kickoff_overdue"
  | "recommend_white_glove"
  | "implementation_waiting"
  | "launch_checklist"
  | "pricing_engagement"
  | "silence"
  | "expansion"
  | "new_inquiry"
  | "referral"
  | "task_overdue"
  | "wg_overdue"
  | "no_login_after_activation"
  | "onboarding_stalled"
  | "payment_failed"
  | "inactive_customer"
  | "sales_proposal_followup"
  | "sales_schedule_walkthrough"
  | "sales_inactivity"
  | "cs_invite_team"
  | "cs_publish_website"
  | "cs_schedule_onboarding"
  | "cs_declining_engagement"
  | "cs_renewal_outreach"
  | "general";

export type LuvDraftKind =
  | "email"
  | "follow_up"
  | "welcome"
  | "welcome_back"
  | "white_glove_kickoff"
  | "launch_checklist"
  | "white_glove_recommend"
  | "renewal"
  | "referral"
  | "support"
  | "meeting_summary"
  | "internal_note";

export type LuvInsightAction =
  | "draft"
  | "send_email"
  | "create_task"
  | "verify_welcome_back"
  | "dismiss"
  | "view";

export type LuvInsight = {
  id: string;
  type: LuvInsightType;
  relationshipId: string;
  venueName: string;
  message: string;
  detail?: string;
  severity: LuvSeverity;
  priority: number;
  actions: LuvInsightAction[];
  /** Preferred primary CTA (defaults to first actionable in `actions`). */
  primaryAction?: LuvInsightAction;
  draftKind?: LuvDraftKind;
  meta?: Record<string, string | number | boolean | null>;
};

export type LuvBriefingBullet = {
  id: string;
  text: string;
  relationshipId?: string;
  insightId?: string;
};

export type LuvBriefing = {
  greeting: string;
  firstName: string;
  bullets: LuvBriefingBullet[];
  closing: string;
  /** Insights backing the briefing CTA batch. */
  followUpInsights: LuvInsight[];
  generatedAt: string;
};

export type LuvDraft = {
  id: string;
  kind: LuvDraftKind;
  label: string;
  relationshipId: string;
  venueName: string;
  subject: string;
  body: string;
  channel: "email" | "internal_note" | "support";
  templateId?: string;
  insightId?: string;
};

export type LuvDismissal = {
  insightId: string;
  relationshipId?: string | null;
  actorId: string;
  dismissedAt: string;
};
