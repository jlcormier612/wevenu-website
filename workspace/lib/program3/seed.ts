import type {
  BrandingConfig,
  Sequence,
  Template,
  TemplateCategory,
  Workflow,
} from "./types";
import { DEFAULT_SEQUENCE_TIMEZONE } from "./schedule";

const NOW = "2026-07-15T12:00:00.000Z";

export const SEED_CATEGORIES: TemplateCategory[] = [
  {
    id: "cat_prospect_nurture",
    name: "Prospect nurture",
    description: "Inquiry through trial — before subscribe",
  },
  {
    id: "cat_customer_checkin",
    name: "Customer check-in",
    description: "Subscribed+ follow-ups and care",
  },
  {
    id: "cat_welcome_back",
    name: "Welcome Back",
    description: "Former customers returning to Founding",
  },
  {
    id: "cat_sales",
    name: "Sales",
    description: "Inquiry through walkthrough nurture",
  },
  {
    id: "cat_onboarding",
    name: "Onboarding",
    description: "Kickoff and first-30-days",
  },
  {
    id: "cat_success",
    name: "Customer Success",
    description: "Live, expansion, renewal",
  },
];

export const SEED_TEMPLATES: Template[] = [
  {
    id: "tpl_inquiry_welcome",
    name: "Inquiry welcome",
    categoryId: "cat_sales",
    subject: "Welcome, {{owner_first_name}} — let's talk about {{venue_name}}",
    body: `Hi {{owner_first_name}},

Thank you for reaching out about {{venue_name}}. We're excited to learn how Hello to Cheers can support your celebrations.

I'd love to schedule a short walkthrough of the platform when it works for you.

Warmly,
The Hello to Cheers team`,
    variables: ["owner_first_name", "venue_name"],
    approval: "approved",
    publishStatus: "published",
    versions: [
      {
        id: "tv_inquiry_1",
        version: 1,
        subject: "Welcome, {{owner_first_name}} — let's talk about {{venue_name}}",
        body: `Hi {{owner_first_name}},\n\nThank you for reaching out about {{venue_name}}.`,
        createdAt: NOW,
        note: "Initial draft",
      },
      {
        id: "tv_inquiry_2",
        version: 2,
        subject: "Welcome, {{owner_first_name}} — let's talk about {{venue_name}}",
        body: `Hi {{owner_first_name}},

Thank you for reaching out about {{venue_name}}. We're excited to learn how Hello to Cheers can support your celebrations.

I'd love to schedule a short walkthrough of the platform when it works for you.

Warmly,
The Hello to Cheers team`,
        createdAt: "2026-07-16T10:00:00.000Z",
        note: "Softened CTA",
      },
    ],
    sentCount: 12,
    openCount: 8,
    createdAt: NOW,
    updatedAt: "2026-07-16T10:00:00.000Z",
  },
  {
    id: "tpl_walkthrough_confirm",
    name: "Walkthrough confirmation",
    categoryId: "cat_sales",
    subject: "You're confirmed — {{venue_name}} walkthrough",
    body: `Hi {{owner_first_name}},

Looking forward to walking through Hello to Cheers with you for {{venue_name}}.

We'll cover inquiry → celebration in about 30 minutes. Reply if you need to reschedule.

See you soon,
Hello to Cheers`,
    variables: ["owner_first_name", "venue_name"],
    approval: "approved",
    publishStatus: "published",
    versions: [
      {
        id: "tv_wt_1",
        version: 1,
        subject: "You're confirmed — {{venue_name}} walkthrough",
        body: `Hi {{owner_first_name}},\n\nLooking forward to walking through Hello to Cheers with you for {{venue_name}}.`,
        createdAt: NOW,
      },
    ],
    sentCount: 7,
    openCount: 6,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_post_walkthrough",
    name: "Post-walkthrough follow-up",
    categoryId: "cat_sales",
    subject: "Next steps for {{venue_name}}",
    body: `Hi {{owner_first_name}},

It was wonderful meeting you. When you're ready, the {{plan}} plan is a lovely fit for {{venue_name}}.

Happy to answer any questions — or we can hold a Founding Member spot if you're exploring Welcome Back.

Cheers,
Hello to Cheers`,
    variables: ["owner_first_name", "venue_name", "plan"],
    approval: "approved",
    publishStatus: "published",
    versions: [
      {
        id: "tv_post_1",
        version: 1,
        subject: "Next steps for {{venue_name}}",
        body: `Hi {{owner_first_name}},\n\nIt was wonderful meeting you.`,
        createdAt: NOW,
      },
    ],
    sentCount: 5,
    openCount: 4,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_onboarding_kickoff",
    name: "Onboarding kickoff",
    categoryId: "cat_onboarding",
    subject: "Let's get {{venue_name}} live",
    body: `Hi {{owner_first_name}},

Welcome aboard. Your {{plan}} subscription is active and we're ready to set up {{venue_name}}.

I'll send a short checklist and propose a kickoff time this week.

With care,
Hello to Cheers Success`,
    variables: ["owner_first_name", "venue_name", "plan"],
    approval: "approved",
    publishStatus: "published",
    versions: [
      {
        id: "tv_ob_1",
        version: 1,
        subject: "Let's get {{venue_name}} live",
        body: `Hi {{owner_first_name}},\n\nWelcome aboard.`,
        createdAt: NOW,
      },
    ],
    sentCount: 4,
    openCount: 3,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_live_checkin",
    name: "Live 30-day check-in",
    categoryId: "cat_customer_checkin",
    subject: "How is {{venue_name}} feeling thirty days in?",
    body: `Hi {{owner_first_name}},

Checking in on {{venue_name}} — how's the first month with Hello to Cheers?

If anything feels unclear, reply here and we'll hop on a quick call.

Grateful you're with us,
Hello to Cheers`,
    variables: ["owner_first_name", "venue_name"],
    approval: "draft",
    publishStatus: "draft",
    versions: [
      {
        id: "tv_live_1",
        version: 1,
        subject: "How is {{venue_name}} feeling thirty days in?",
        body: `Hi {{owner_first_name}},\n\nChecking in on {{venue_name}}.`,
        createdAt: NOW,
      },
    ],
    sentCount: 0,
    openCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_welcome_back_warm",
    name: "Welcome Back warmth",
    categoryId: "cat_welcome_back",
    subject: "{{owner_first_name}}, {{venue_name}} is welcome back",
    body: `Hi {{owner_first_name}},

We'd love to welcome {{venue_name}} back to Hello to Cheers — Founding Member pricing may still be available.

Reply when you're ready and we'll verify Welcome Back together.

With care,
Hello to Cheers`,
    variables: ["owner_first_name", "venue_name"],
    approval: "approved",
    publishStatus: "published",
    versions: [
      {
        id: "tv_wb_1",
        version: 1,
        subject: "{{owner_first_name}}, {{venue_name}} is welcome back",
        body: `Hi {{owner_first_name}},\n\nWe'd love to welcome {{venue_name}} back.`,
        createdAt: NOW,
      },
    ],
    sentCount: 0,
    openCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "tpl_quarterly_checkin",
    name: "Quarterly customer check-in",
    categoryId: "cat_customer_checkin",
    subject: "A quiet check-in for {{venue_name}}",
    body: `Hi {{owner_first_name}},

Just a note from us — how is {{venue_name}} feeling this season?

No agenda. Reply anytime if we can help with celebrations, vendors, or the guest experience.

Warmly,
Hello to Cheers Success`,
    variables: ["owner_first_name", "venue_name"],
    approval: "approved",
    publishStatus: "published",
    versions: [
      {
        id: "tv_q_1",
        version: 1,
        subject: "A quiet check-in for {{venue_name}}",
        body: `Hi {{owner_first_name}},\n\nJust a note from us.`,
        createdAt: NOW,
      },
    ],
    sentCount: 0,
    openCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const SEED_SEQUENCES: Sequence[] = [
  {
    id: "seq_inquiry_nurture",
    name: "Inquiry nurture",
    description: "Welcome → gentle follow-up over a week (relative delays)",
    categoryId: "cat_prospect_nurture",
    approval: "approved",
    targeting: "prospects",
    timezone: DEFAULT_SEQUENCE_TIMEZONE,
    active: true,
    steps: [
      {
        id: "ss_1",
        templateId: "tpl_inquiry_welcome",
        delayHours: 0,
        scheduleMode: "relative",
        label: "Day 0 welcome",
      },
      {
        id: "ss_2",
        templateId: "tpl_post_walkthrough",
        delayHours: 72,
        scheduleMode: "relative",
        label: "Day 3 nudge",
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "seq_onboarding",
    name: "Onboarding welcome",
    description: "Kickoff email after subscribe",
    categoryId: "cat_onboarding",
    approval: "approved",
    targeting: "customers",
    timezone: DEFAULT_SEQUENCE_TIMEZONE,
    active: true,
    steps: [
      {
        id: "ss_ob_1",
        templateId: "tpl_onboarding_kickoff",
        delayHours: 1,
        scheduleMode: "relative",
        label: "Kickoff",
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "seq_customer_checkin",
    name: "Customer quarterly check-in",
    description: "Immediate warmth + absolute calendar check-in (America/New_York)",
    categoryId: "cat_customer_checkin",
    approval: "approved",
    targeting: "customers",
    timezone: DEFAULT_SEQUENCE_TIMEZONE,
    active: true,
    steps: [
      {
        id: "ss_cc_1",
        templateId: "tpl_live_checkin",
        delayHours: 0,
        scheduleMode: "relative",
        label: "Near-term check-in",
      },
      {
        id: "ss_cc_2",
        templateId: "tpl_quarterly_checkin",
        delayHours: 0,
        scheduleMode: "absolute",
        absoluteAt: "2026-10-01T09:00",
        timezone: DEFAULT_SEQUENCE_TIMEZONE,
        label: "October 1 morning note",
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "seq_welcome_back",
    name: "Welcome Back outreach",
    description: "Warm former customers — relative + absolute follow-up",
    categoryId: "cat_welcome_back",
    approval: "approved",
    targeting: "customers",
    timezone: DEFAULT_SEQUENCE_TIMEZONE,
    active: true,
    steps: [
      {
        id: "ss_wb_1",
        templateId: "tpl_welcome_back_warm",
        delayHours: 0,
        scheduleMode: "relative",
        label: "Warm invite",
      },
      {
        id: "ss_wb_2",
        templateId: "tpl_welcome_back_warm",
        delayHours: 168,
        scheduleMode: "relative",
        label: "One-week nudge",
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

export const SEED_BRANDING: BrandingConfig = {
  id: "branding_default",
  fromName: "Hello to Cheers",
  fromEmail: "hello@hellotocheers.com",
  replyToEmail: "success@hellotocheers.com",
  signatureHtml: "With care,\nThe Hello to Cheers team",
  updatedAt: NOW,
};

export const SEED_WORKFLOWS: Workflow[] = [
  {
    id: "wf_inquiry_welcome",
    name: "New inquiry welcome",
    description: "When a venue enters Inquiry — welcome email, task, and gentle follow-up.",
    active: true,
    trigger: { type: "status_enter", status: "inquiry" },
    steps: [
      {
        id: "wfs_1",
        type: "send_email",
        label: "Send welcome email",
        templateId: "tpl_inquiry_welcome",
        delayHours: 0,
      },
      {
        id: "wfs_2",
        type: "create_task",
        label: "Create qualify task",
        taskTitle: "Qualify inquiry for {{venue_name}}",
        taskPriority: "high",
        delayHours: 0,
      },
      {
        id: "wfs_3",
        type: "delay",
        label: "Wait 3 days",
        delayHours: 72,
      },
      {
        id: "wfs_4",
        type: "internal_reminder",
        label: "Remind owner to follow up",
        message: "Follow up with {{owner_first_name}} at {{venue_name}} if no walkthrough yet.",
        delayHours: 0,
      },
      {
        id: "wfs_5",
        type: "notify_team",
        label: "Notify success lead",
        teamMemberId: "tm_maya",
        message: "{{venue_name}} still in inquiry after 3 days.",
        delayHours: 0,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "wf_walkthrough_scheduled",
    name: "Walkthrough scheduled",
    description: "Confirm the walkthrough and assign the walkthrough owner.",
    active: true,
    trigger: { type: "status_enter", status: "walkthrough_scheduled" },
    steps: [
      {
        id: "wfs_wt_1",
        type: "send_email",
        label: "Send confirmation",
        templateId: "tpl_walkthrough_confirm",
        delayHours: 0,
      },
      {
        id: "wfs_wt_2",
        type: "assign_owner",
        label: "Assign walkthrough owner",
        teamMemberId: "tm_sara",
        delayHours: 0,
      },
      {
        id: "wfs_wt_3",
        type: "create_task",
        label: "Prep walkthrough notes",
        taskTitle: "Prep walkthrough for {{venue_name}}",
        taskPriority: "medium",
        delayHours: 0,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "wf_onboarding_start",
    name: "Onboarding kickoff",
    description: "Manual or on enter Onboarding — kickoff email + wait until Live.",
    active: true,
    trigger: { type: "status_enter", status: "onboarding" },
    steps: [
      {
        id: "wfs_ob_1",
        type: "send_email",
        label: "Kickoff email",
        templateId: "tpl_onboarding_kickoff",
        delayHours: 1,
      },
      {
        id: "wfs_ob_2",
        type: "create_task",
        label: "Schedule kickoff call",
        taskTitle: "Schedule kickoff with {{owner_first_name}}",
        taskPriority: "high",
        delayHours: 0,
      },
      {
        id: "wfs_ob_3",
        type: "wait_condition",
        label: "Wait until Live",
        waitUntilStatus: "live",
      },
      {
        id: "wfs_ob_4",
        type: "internal_reminder",
        label: "Celebrate go-live",
        message: "{{venue_name}} is live — send a personal note.",
        delayHours: 0,
      },
      {
        id: "wfs_ob_5",
        type: "exit",
        label: "Exit workflow",
        exitReason: "Onboarding complete",
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "wf_manual_nurture",
    name: "Manual nurture sequence",
    description: "Run the inquiry nurture sequence on demand.",
    active: true,
    trigger: { type: "manual" },
    steps: [
      {
        id: "wfs_man_1",
        type: "send_email",
        label: "Run nurture sequence",
        sequenceId: "seq_inquiry_nurture",
        delayHours: 0,
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
  },
];
