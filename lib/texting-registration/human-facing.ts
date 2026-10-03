/**
 * Human-facing Texting Setup explanation + grounded Luv assist.
 * Pure helpers over authoritative TextingStatusPanel — no provisioning side effects.
 */
import type { TextingPhase, TextingStatusPanel } from "@/lib/texting-registration/types";
import { assertNoProviderLeak } from "@/lib/texting-registration/status-panel";

/** Published Help article slug (SetupGuideLink / INTEGRATION_SETUP_ARTICLES). */
export const TEXTING_SETUP_GUIDE_SLUG = "how-texting-setup-works" as const;
export const TEXTING_SETUP_GUIDE_HREF = `/help/${TEXTING_SETUP_GUIDE_SLUG}` as const;
export const TEXTING_SETUP_GUIDE_LABEL = "Need help? Open the Texting Setup Guide" as const;

/** Plain-English orientation shown on the Texting Setup card (not phase-specific). */
export const TEXTING_WHAT_IT_ENABLES =
  "Texting lets your venue message clients and leads from Inbox — tour reminders, booking questions, and event logistics — from a dedicated texting number for your venue.";

export const TEXTING_WHY_WE_COLLECT =
  "Hello to Cheers needs your real business and messaging details so we can set up texting for your venue under your business identity. You choose each answer; we do not invent legal or registration information for you.";

export const TEXTING_WHAT_HTC_HANDLES =
  "After you save your information, Hello to Cheers handles the technical setup behind the scenes — including assigning your texting number when it is ready. You do not enter provider credentials or manage carrier registration yourself.";

export const TEXTING_HOW_YOU_KNOW_READY =
  "When texting is ready, this page will show Ready and your assigned texting number. You can also confirm readiness in Communication Health before you send a real text.";

export type TextingPhaseStory = {
  phase: TextingPhase;
  whatHappened: string;
  whatHappensNext: string;
  ownerNeedsToDo: string;
};

export type TextingSetupLuvContext = {
  phase: TextingPhase;
  displayHeadline: string;
  businessInformationLabel: string;
  messagingRegistrationLabel: string;
  textingNumberLabel: string;
  textingLabel: string;
  hasE164Number: boolean;
  textingNumberE164: string | null;
  smsReady: boolean;
  attentionMessage: string | null;
  attentionFixHint: string | null;
  canResubmit: boolean;
  canEdit: boolean;
};

export type TextingLuvSuggestion = {
  id: string;
  label: string;
};

/** Display headline for status (matches venue UI; never invents readiness). */
export function textingDisplayHeadline(panel: TextingStatusPanel): string {
  if (panel.smsReady) return "Ready";
  switch (panel.phase) {
    case "information_saved":
      return "Setting up";
    case "under_review":
      return "Setup in progress";
    case "setting_up_number":
      return "Setting up your texting number";
    case "needs_attention":
    case "failed":
      return "Needs attention";
    case "paused":
      return "Paused";
    default:
      return "Not ready";
  }
}

export function buildTextingPhaseStory(panel: TextingStatusPanel): TextingPhaseStory {
  const hasNumber = Boolean(panel.textingNumber.e164);
  const numberClause = hasNumber
    ? `Your texting number is ${panel.textingNumber.label}.`
    : "No texting number has been assigned yet.";

  switch (panel.phase) {
    case "not_started":
      return {
        phase: panel.phase,
        whatHappened: "Texting has not been started for your venue yet.",
        whatHappensNext:
          "When you enable text messaging, you will confirm your business details and tell us how you plan to text clients.",
        ownerNeedsToDo: "Start setup when you are ready — choose Enable text messaging.",
      };
    case "details_needed":
      return {
        phase: panel.phase,
        whatHappened: "Setup has started, but some required details are still missing or need to be finished.",
        whatHappensNext:
          "Complete the remaining business and messaging details, then save. Hello to Cheers will continue setup after that.",
        ownerNeedsToDo: "Continue setup and finish the required information.",
      };
    case "information_saved":
      return {
        phase: panel.phase,
        whatHappened:
          "Your information has been received and saved. Hello to Cheers is working through texting setup for your venue.",
        whatHappensNext: hasNumber
          ? `${numberClause} Texting is not ready to send yet until this page shows Ready.`
          : `${numberClause} Texting is not ready yet. We will update this page when setup finishes.`,
        ownerNeedsToDo: "No action is required from you right now.",
      };
    case "under_review":
      return {
        phase: panel.phase,
        whatHappened: "Your information is saved, and Hello to Cheers is actively working through texting setup.",
        whatHappensNext: hasNumber
          ? `${numberClause} Texting becomes usable when this page shows Ready.`
          : "We will assign your texting number when it is ready. No specific timeline is shown here.",
        ownerNeedsToDo: "No action is required from you right now.",
      };
    case "setting_up_number":
      return {
        phase: panel.phase,
        whatHappened: "Hello to Cheers is finishing the last steps of texting setup for your venue.",
        whatHappensNext: hasNumber
          ? `${numberClause} Texting is usable when status shows Ready.`
          : "Your texting number will appear here once it is assigned.",
        ownerNeedsToDo: "No action is required from you right now.",
      };
    case "needs_attention":
      return {
        phase: panel.phase,
        whatHappened:
          panel.attention?.message
          ?? "Texting setup needs attention. Some business information needs to be updated.",
        whatHappensNext:
          panel.attention?.fixHint
          ?? "Update the details that need attention, then save again so Hello to Cheers can continue.",
        ownerNeedsToDo: "Update your details using Update details & resubmit on this page.",
      };
    case "failed":
      return {
        phase: panel.phase,
        whatHappened:
          panel.attention?.message
          ?? "Texting setup ran into a problem and could not finish with the information on file.",
        whatHappensNext:
          panel.attention?.fixHint
          ?? "Review your details, fix anything that looks wrong, and save again — or contact support if you need help.",
        ownerNeedsToDo: "Update your details and try again, or contact support.",
      };
    case "ready":
      return {
        phase: panel.phase,
        whatHappened: panel.smsReady
          ? `Texting is ready for your venue.${hasNumber ? ` ${numberClause}` : ""}`
          : "Setup has reached the ready stage, but send readiness is not confirmed yet on this page.",
        whatHappensNext: panel.smsReady
          ? "You can text clients and leads from Inbox when they have given texting permission."
          : "Check back here or Communication Health until Texting shows Ready.",
        ownerNeedsToDo: panel.smsReady
          ? "No setup action needed — use Inbox when you are ready to text."
          : "No setup action needed while Hello to Cheers finishes readiness.",
      };
    case "paused":
      return {
        phase: panel.phase,
        whatHappened: "Texting for your venue is paused.",
        whatHappensNext: "Outbound texting stays unavailable while paused. Contact support if you need it turned back on.",
        ownerNeedsToDo: "No routine setup action on this page while texting is paused.",
      };
    default: {
      const _exhaustive: never = panel.phase;
      return _exhaustive;
    }
  }
}

export function buildTextingSetupLuvContext(input: {
  panel: TextingStatusPanel;
  canEdit: boolean;
}): TextingSetupLuvContext {
  const { panel, canEdit } = input;
  return {
    phase: panel.phase,
    displayHeadline: textingDisplayHeadline(panel),
    businessInformationLabel: panel.businessInformation.label,
    messagingRegistrationLabel: panel.messagingRegistration.label,
    textingNumberLabel: panel.textingNumber.label,
    textingLabel: panel.texting.label,
    hasE164Number: Boolean(panel.textingNumber.e164),
    textingNumberE164: panel.textingNumber.e164,
    smsReady: panel.smsReady,
    attentionMessage: panel.attention?.message ?? null,
    attentionFixHint: panel.attention?.fixHint ?? null,
    canResubmit: panel.canResubmit,
    canEdit,
  };
}

export function textingLuvSuggestions(ctx: TextingSetupLuvContext): TextingLuvSuggestion[] {
  const base: TextingLuvSuggestion[] = [
    { id: "status", label: "What's my texting status?" },
    { id: "why-info", label: "Why do you need my business information?" },
    { id: "next", label: "What do I need to do next?" },
    { id: "when-ready", label: "What happens when texting is ready?" },
    { id: "consent", label: "How do consent and STOP work?" },
  ];
  if (ctx.phase === "needs_attention" || ctx.phase === "failed") {
    base.push({ id: "update", label: "Where do I update my information?" });
  }
  return base;
}

const UNSUPPORTED_PROGRESS =
  "I can only speak from your current texting status on this page. I don’t invent setup progress, timelines, or carrier decisions.";

function answerStatus(ctx: TextingSetupLuvContext): string {
  const story = buildTextingPhaseStory({
    phase: ctx.phase,
    businessInformation: { label: ctx.businessInformationLabel, tone: "not_ready" },
    messagingRegistration: { label: ctx.messagingRegistrationLabel, tone: "not_ready" },
    textingNumber: {
      label: ctx.textingNumberLabel,
      tone: "not_ready",
      e164: ctx.textingNumberE164,
    },
    texting: { label: ctx.textingLabel, tone: "not_ready" },
    attention: ctx.attentionMessage
      ? { code: null, message: ctx.attentionMessage, fixHint: ctx.attentionFixHint }
      : null,
    canResubmit: ctx.canResubmit,
    smsReady: ctx.smsReady,
  });

  const numberLine = ctx.hasE164Number && ctx.textingNumberE164
    ? `Your assigned texting number is ${ctx.textingNumberLabel}.`
    : "No texting number is assigned yet.";
  const readyLine = ctx.smsReady
    ? "Texting is ready to send from Inbox (when the recipient has given permission)."
    : "Texting is not ready to send yet.";

  return [
    `Status: ${ctx.displayHeadline}.`,
    story.whatHappened,
    numberLine,
    readyLine,
    `What happens next: ${story.whatHappensNext}`,
    `What you need to do: ${story.ownerNeedsToDo}`,
  ].join(" ");
}

function answerWhyInfo(): string {
  return TEXTING_WHY_WE_COLLECT;
}

function answerNext(ctx: TextingSetupLuvContext): string {
  const story = buildTextingPhaseStory({
    phase: ctx.phase,
    businessInformation: { label: ctx.businessInformationLabel, tone: "not_ready" },
    messagingRegistration: { label: ctx.messagingRegistrationLabel, tone: "not_ready" },
    textingNumber: {
      label: ctx.textingNumberLabel,
      tone: "not_ready",
      e164: ctx.textingNumberE164,
    },
    texting: { label: ctx.textingLabel, tone: "not_ready" },
    attention: ctx.attentionMessage
      ? { code: null, message: ctx.attentionMessage, fixHint: ctx.attentionFixHint }
      : null,
    canResubmit: ctx.canResubmit,
    smsReady: ctx.smsReady,
  });
  return story.ownerNeedsToDo;
}

function answerWhenReady(ctx: TextingSetupLuvContext): string {
  if (ctx.smsReady) {
    const num = ctx.hasE164Number
      ? ` Texts send from ${ctx.textingNumberLabel}.`
      : "";
    return `Texting is already ready for your venue.${num} Use Inbox to message clients who have given texting permission.`;
  }
  return TEXTING_HOW_YOU_KNOW_READY;
}

function answerConsent(): string {
  return (
    "People must give clear texting permission before you text them — a phone number alone is not permission. "
    + "Permission is typically collected on your inquiry and tour forms. "
    + "If someone replies STOP, texting to them becomes unavailable and you should not continue texting that number."
  );
}

function answerUpdate(ctx: TextingSetupLuvContext): string {
  if (ctx.phase === "needs_attention" || ctx.phase === "failed") {
    if (ctx.canEdit || ctx.canResubmit) {
      return (
        "Use Update details & resubmit on this Texting Setup page. "
        + (ctx.attentionFixHint ? ctx.attentionFixHint : "Fix the highlighted details, then save again.")
      );
    }
    return "Texting setup needs attention, but your role may not allow edits. Ask a venue owner or manager to update the details on this page.";
  }
  if (ctx.phase === "information_saved" && ctx.canEdit) {
    return (
      "You can choose Update details on this page if something needs correcting. "
      + "Saving a draft returns you to finishing details; texting stays not ready until setup finishes."
    );
  }
  if (ctx.canEdit) {
    return "You can update your texting information from this Texting Setup page when the form is available.";
  }
  return "Only a venue owner or manager can change texting setup details.";
}

/**
 * Grounded Luv answers for Texting Setup. Uses only TextingSetupLuvContext —
 * never invents ETAs, carrier approval, number assignment, or readiness.
 */
export function answerTextingSetupLuvQuestion(
  question: string,
  ctx: TextingSetupLuvContext,
): string {
  const q = question.trim().toLowerCase();
  if (!q) {
    return "Ask about your current texting status, what happens next, or how consent works — I’ll answer from what’s shown on this page.";
  }

  // Refuse invented progress / ETA / carrier questions when we cannot support them.
  if (
    /\b(eta|how long|when will|timeline|how many days|carrier|approved|approval|a2p|10dlc|twilio|trust\s*hub)\b/i
      .test(q)
  ) {
    if (/\b(carrier|approved|approval|a2p|10dlc|twilio|trust\s*hub)\b/i.test(q)) {
      return `${UNSUPPORTED_PROGRESS} I can tell you your current status (${ctx.displayHeadline}) and whether texting is ready to send (${ctx.smsReady ? "yes" : "not yet"}).`;
    }
    if (!ctx.smsReady) {
      return `${UNSUPPORTED_PROGRESS} Right now texting is not ready yet, and no timeline is shown on this page.`;
    }
  }

  let answer: string;
  if (
    q.includes("status")
    || q.includes("where am i")
    || q.includes("what's my")
    || q.includes("whats my")
  ) {
    answer = answerStatus(ctx);
  } else if (
    q.includes("why") && (q.includes("information") || q.includes("business") || q.includes("collect") || q.includes("need"))
  ) {
    answer = answerWhyInfo();
  } else if (
    q.includes("next")
    || q.includes("need to do")
    || q.includes("do i need")
    || q.includes("anything right now")
  ) {
    answer = answerNext(ctx);
  } else if (
    q.includes("when") && (q.includes("ready") || q.includes("done") || q.includes("finished"))
    || q.includes("what happens when")
    || q.includes("how will i know")
  ) {
    answer = answerWhenReady(ctx);
  } else if (
    q.includes("consent")
    || q.includes("stop")
    || q.includes("opt in")
    || q.includes("opt-in")
    || q.includes("permission")
  ) {
    answer = answerConsent();
  } else if (
    q.includes("update")
    || q.includes("change")
    || q.includes("edit")
    || q.includes("resubmit")
    || q.includes("where do i")
  ) {
    answer = answerUpdate(ctx);
  } else if (q.includes("what does texting") || q.includes("enable") || q.includes("what is texting")) {
    answer = TEXTING_WHAT_IT_ENABLES;
  } else if (q.includes("handle") || q.includes("behind the scenes") || q.includes("doing for me")) {
    answer = TEXTING_WHAT_HTC_HANDLES;
  } else if (q.includes("number")) {
    answer = ctx.hasE164Number && ctx.textingNumberE164
      ? `Your assigned texting number is ${ctx.textingNumberLabel}.`
      : "No texting number has been assigned yet according to your current status.";
  } else if (q.includes("ready")) {
    answer = ctx.smsReady
      ? "Texting is ready to send from Inbox when recipients have given permission."
      : "Texting is not ready to send yet according to your current status.";
  } else {
    answer = [
      answerStatus(ctx),
      "You can also ask why we collect business information, what to do next, consent/STOP, or what happens when texting is ready.",
    ].join(" ");
  }

  assertNoProviderLeak(answer);
  return answer;
}

/** All customer-facing explanation strings for a panel (for leak / claim tests). */
export function collectTextingHumanFacingCopy(panel: TextingStatusPanel): string {
  const story = buildTextingPhaseStory(panel);
  const ctx = buildTextingSetupLuvContext({ panel, canEdit: true });
  const parts = [
    TEXTING_WHAT_IT_ENABLES,
    TEXTING_WHY_WE_COLLECT,
    TEXTING_WHAT_HTC_HANDLES,
    TEXTING_HOW_YOU_KNOW_READY,
    story.whatHappened,
    story.whatHappensNext,
    story.ownerNeedsToDo,
    textingDisplayHeadline(panel),
    ...textingLuvSuggestions(ctx).map((s) => s.label),
    ...textingLuvSuggestions(ctx).map((s) => answerTextingSetupLuvQuestion(s.label, ctx)),
  ];
  return parts.join("\n");
}
