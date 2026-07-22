import { interpolate, varsForRelationship } from "@/lib/program3/variables";
import { getTemplatesSync } from "@/lib/program3/store";
import type { Relationship, WorkspaceData } from "@/lib/types";

import { draftKindForInsight } from "./insights";
import type { LuvDraft, LuvDraftKind, LuvInsight } from "./types";

type DraftTemplate = {
  kind: LuvDraftKind;
  label: string;
  subject: string;
  body: string;
  channel: LuvDraft["channel"];
  /** Optional Communication Library template id to prefer when present. */
  libraryTemplateId?: string;
};

const BUILTIN: DraftTemplate[] = [
  {
    kind: "email",
    label: "Warm introduction",
    subject: "Hello from Hello to Cheers — {{venue_name}}",
    body: `Hi {{owner_first_name}},

Thank you for reaching out about {{venue_name}}. We built Hello to Cheers for venues that want calmer operations without losing the hospitality that makes them special.

I'd love to learn what {{venue_name}} needs most right now — and show you how the workspace can carry the season with you.

Would a short walkthrough this week feel helpful?

Warmly,
{{actor_first_name}}
Hello to Cheers`,
    channel: "email",
    libraryTemplateId: "tpl_inquiry_welcome",
  },
  {
    kind: "follow_up",
    label: "Post-walkthrough follow-up",
    subject: "Next steps for {{venue_name}}",
    body: `Hi {{owner_first_name}},

It was a pleasure walking through Hello to Cheers with you for {{venue_name}}.

As promised, I'm sharing next steps for {{plan}} — including what onboarding would look like and how White Glove can support your team if you'd like a guided start.

Happy to answer anything that came up after we spoke. When would be a good moment to reconnect?

Warmly,
{{actor_first_name}}`,
    channel: "email",
    libraryTemplateId: "tpl_post_walkthrough",
  },
  {
    kind: "welcome",
    label: "Welcome / Founder Welcome",
    subject: "Welcome to Hello to Cheers — {{venue_name}}",
    body: `Hi {{owner_first_name}},

Welcome to Hello to Cheers. We're glad {{venue_name}} is here.

Your {{plan}} subscription is active. You can take your time with setup — we'll keep the path clear and the noise low.

If you need anything, just reply to this email. We're listening.

Warmly,
{{actor_first_name}}
Hello to Cheers`,
    channel: "email",
  },
  {
    kind: "welcome_back",
    label: "Welcome Back response",
    subject: "Welcome Back pricing for {{venue_name}}",
    body: `Hi {{owner_first_name}},

Thank you for requesting Welcome Back for {{venue_name}}. We're verifying founding eligibility now and will confirm your pricing shortly.

If anything has changed about timing or plan preference (Gather, Celebrate, or Flourish), just reply and we'll fold it in.

Glad to have you back in the circle.

Warmly,
{{actor_first_name}}
Hello to Cheers`,
    channel: "email",
  },
  {
    kind: "white_glove_kickoff",
    label: "White Glove kickoff",
    subject: "Let's schedule {{venue_name}}'s White Glove kickoff",
    body: `Hi {{owner_first_name}},

We're ready to begin White Glove onboarding for {{venue_name}}.

Could you share two or three times that work for a kickoff call? We'll bring a tailored agenda covering workspace setup, team roles, and your first live event milestones.

Looking forward to getting {{venue_name}} settled in beautifully.

Warmly,
{{actor_first_name}}`,
    channel: "email",
    libraryTemplateId: "tpl_onboarding_kickoff",
  },
  {
    kind: "launch_checklist",
    label: "Launch Checklist",
    subject: "Your Launch Checklist for {{venue_name}}",
    body: `Hi {{owner_first_name}},

As we move {{venue_name}} toward go-live, here's the Launch Checklist we'll walk together:

1. Venue branding
2. Packages
3. Contracts
4. Questionnaires
5. Email templates
6. Website review
7. Launch review
8. Go Live

I'll stay close on each step. Reply with anything you'd like us to prioritize first.

Warmly,
{{actor_first_name}}
Hello to Cheers`,
    channel: "email",
  },
  {
    kind: "white_glove_recommend",
    label: "Recommend White Glove",
    subject: "A guided start for {{venue_name}}",
    body: `Hi {{owner_first_name}},

Venues on {{plan}} often find White Glove settles the first season more calmly — branding, packages, contracts, and go-live reviewed with our team beside you.

If a guided launch would serve {{venue_name}}, I'd be glad to walk through what White Glove includes and how kickoff works.

No pressure — Self-Guided remains fully available. Just an option worth knowing.

Warmly,
{{actor_first_name}}
Hello to Cheers`,
    channel: "email",
  },
  {
    kind: "renewal",
    label: "Renewal check-in",
    subject: "Checking in on {{venue_name}} before renewal",
    body: `Hi {{owner_first_name}},

{{venue_name}} has been part of Hello to Cheers for a meaningful stretch, and renewal is coming into view.

I'd love a short check-in — what's working, what you'd like more of, and whether {{plan}} still feels like the right fit (or if an expansion conversation would serve you better).

Would a 20-minute call next week work?

Warmly,
{{actor_first_name}}`,
    channel: "email",
    libraryTemplateId: "tpl_live_checkin",
  },
  {
    kind: "referral",
    label: "Warm re-open / referral",
    subject: "Thinking of {{venue_name}}",
    body: `Hi {{owner_first_name}},

I've been thinking about {{venue_name}} and wanted to leave the door open.

If the season has settled and you're curious about Hello to Cheers again — or know another venue that would love a calmer operating rhythm — I'd be glad to reconnect.

No pressure. Just warmth from our side.

{{actor_first_name}}
Hello to Cheers`,
    channel: "email",
  },
  {
    kind: "support",
    label: "Support response",
    subject: "Re: {{venue_name}} — we're on it",
    body: `Hi {{owner_first_name}},

Thank you for flagging this for {{venue_name}}. I've opened the thread with our team and will update you as soon as we have a clear next step.

In the meantime, if anything else surfaces on the floor, reply here and I'll stay close.

{{actor_first_name}}
Hello to Cheers Support`,
    channel: "support",
  },
  {
    kind: "meeting_summary",
    label: "Meeting summary",
    subject: "Notes from our conversation — {{venue_name}}",
    body: `Hi {{owner_first_name}},

Quick notes from our time together on {{venue_name}}:

• We covered where the season feels busiest
• Next step: confirm plan fit and onboarding path
• I'll follow up with materials by end of week

Reply anytime if I missed something.

Warmly,
{{actor_first_name}}`,
    channel: "email",
  },
  {
    kind: "internal_note",
    label: "Internal note",
    subject: "Luv note — {{venue_name}}",
    body: `Internal note for {{venue_name}} ({{owner_first_name}} {{owner_last_name}}):

Status: {{plan}}
Context: Follow up while momentum is warm. Prefer morning outreach if possible.

— Luv (draft for {{actor_first_name}})`,
    channel: "internal_note",
  },
];

function actorVars(actorName: string): Record<string, string> {
  const first = actorName.trim().split(/\s+/)[0] || "Jen";
  return {
    actor_name: actorName,
    actor_first_name: first,
  };
}

function findBuiltin(kind: LuvDraftKind): DraftTemplate {
  return BUILTIN.find((t) => t.kind === kind) ?? BUILTIN[1]!;
}

function fromLibrary(
  templateId: string | undefined,
  relationship: Relationship,
  extra: Record<string, string>,
): { subject: string; body: string; templateId: string } | null {
  if (!templateId) return null;
  try {
    const templates = getTemplatesSync();
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return null;
    const vars = { ...varsForRelationship(relationship), ...extra };
    return {
      subject: interpolate(tpl.subject, vars),
      body: interpolate(tpl.body, vars),
      templateId: tpl.id,
    };
  } catch {
    return null;
  }
}

/** Optional polish via OpenAI when OPENAI_API_KEY is set. Phase 1: soft-fail to template. */
async function maybePolish(text: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return text;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are Luv, a calm Hello to Cheers chief of staff. Polish the draft lightly — warm, editorial, concise. Keep placeholders like {{venue_name}} intact if present. Return only the polished message body.",
          },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return text;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}

export function buildDraftForInsight(
  insight: LuvInsight,
  relationship: Relationship,
  actorName: string,
  opts?: { preferLibrary?: boolean },
): LuvDraft {
  const kind = draftKindForInsight(insight);
  const builtin = findBuiltin(kind);
  const extra = actorVars(actorName);
  const vars = { ...varsForRelationship(relationship), ...extra };

  let subject = interpolate(builtin.subject, vars);
  let body = interpolate(builtin.body, vars);
  let templateId: string | undefined;

  if (opts?.preferLibrary !== false) {
    const lib = fromLibrary(builtin.libraryTemplateId, relationship, extra);
    if (lib) {
      subject = lib.subject;
      body = lib.body;
      templateId = lib.templateId;
    }
  }

  return {
    id: `draft_${insight.id}`,
    kind,
    label: builtin.label,
    relationshipId: relationship.id,
    venueName: relationship.venue.name,
    subject,
    body,
    channel: builtin.channel,
    templateId,
    insightId: insight.id,
  };
}

export function buildDraftBatch(
  insights: LuvInsight[],
  data: WorkspaceData,
  actorName: string,
): LuvDraft[] {
  const drafts: LuvDraft[] = [];
  for (const insight of insights) {
    const rel = data.relationships.find((r) => r.id === insight.relationshipId);
    if (!rel) continue;
    drafts.push(buildDraftForInsight(insight, rel, actorName));
  }
  return drafts;
}

export function buildDraftsForRelationship(
  relationship: Relationship,
  insights: LuvInsight[],
  actorName: string,
  kinds?: LuvDraftKind[],
): LuvDraft[] {
  const fromInsights = insights
    .filter((i) => i.relationshipId === relationship.id && i.actions.includes("draft"))
    .map((i) => buildDraftForInsight(i, relationship, actorName));

  const wanted = kinds ?? ([
    "follow_up",
    "email",
    "welcome",
    "welcome_back",
    "white_glove_kickoff",
    "launch_checklist",
    "white_glove_recommend",
    "renewal",
    "referral",
    "support",
    "meeting_summary",
    "internal_note",
  ] as LuvDraftKind[]);

  const have = new Set(fromInsights.map((d) => d.kind));
  const extras: LuvDraft[] = [];
  for (const kind of wanted) {
    if (have.has(kind)) continue;
    // Only add contextual extras that fit the relationship.
    if (kind === "welcome_back" && !relationship.welcomeBackRequested) continue;
    if (kind === "welcome" && relationship.status !== "subscribed" && relationship.status !== "onboarding") {
      continue;
    }
    if (kind === "white_glove_kickoff" && relationship.onboardingType !== "white_glove") continue;
    if (kind === "launch_checklist" && relationship.onboardingType !== "white_glove") continue;
    if (kind === "white_glove_recommend" && relationship.onboardingType !== "self_guided") continue;
    if (kind === "support" && relationship.supportOpenCount <= 0 && relationship.status !== "support") {
      continue;
    }
    if (kind === "referral" && relationship.status !== "former_customer") continue;
    const builtin = findBuiltin(kind);
    const extra = actorVars(actorName);
    const vars = { ...varsForRelationship(relationship), ...extra };
    extras.push({
      id: `draft_${relationship.id}_${kind}`,
      kind,
      label: builtin.label,
      relationshipId: relationship.id,
      venueName: relationship.venue.name,
      subject: interpolate(builtin.subject, vars),
      body: interpolate(builtin.body, vars),
      channel: builtin.channel,
    });
    if (fromInsights.length + extras.length >= 5) break;
  }

  return [...fromInsights, ...extras];
}

export async function polishDraftBody(body: string): Promise<string> {
  return maybePolish(body);
}
