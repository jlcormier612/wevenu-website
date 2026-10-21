/**
 * Booked-event readiness row detail — derived only from persisted decisions
 * and verified artifact state. Does not invent completion from mere record
 * existence without the matching lifecycle field (released/sent/shared).
 *
 * A valid profile template that has not yet produced an event draft is
 * recoverable (Draft), not Unavailable. Unavailable is reserved for genuine
 * broken configuration that release cannot safely recover.
 */
import type { EventPlaybookApplication } from "@/lib/playbooks/types";
import type { SetupTemplateRefs } from "@/lib/event-setup/template-refs";
import type { SetupDecision, SetupStepKey } from "@/lib/event-setup/state";

export type SetupReadinessStatus =
  | "included"
  | "draft"
  | "needs_action"
  | "shared"
  | "not_included"
  | "unavailable";

export const SETUP_READINESS_LABEL: Record<SetupReadinessStatus, string> = {
  included: "Included",
  draft: "Draft",
  needs_action: "Needs action",
  shared: "Shared",
  not_included: "Not included",
  unavailable: "Unavailable",
};

export type QuestionnaireReadinessInput = {
  kind: string;
  status: string;
  templateId?: string | null;
};

export type EventOrderReadinessInput = {
  status: string;
  sharedAt: string | null;
  templateId?: string | null;
};

export type SetupReadinessContext = {
  step: SetupStepKey;
  decision: SetupDecision | null;
  inheritedRefs: SetupTemplateRefs;
  playbookApplications: EventPlaybookApplication[];
  hasTimeline: boolean;
  timelineItemCount: number;
  questionnaires: QuestionnaireReadinessInput[];
  vendorRecommendationCount: number;
  floorPlanOfferCount: number;
  preferredFloorPlanName: string | null;
  hasEventInventory: boolean;
  eventOrder: EventOrderReadinessInput | null;
  templateNames: {
    planning: string | null;
    timeline: string | null;
    inventory: string | null;
    eventOrder: string | null;
  };
};

export type SetupReadinessDetail = {
  status: SetupReadinessStatus;
  summary: string;
  nextAction: string | null;
};

function planningDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  const client = ctx.playbookApplications.find((a) => a.kind === "client");
  const venue = ctx.playbookApplications.find((a) => a.kind === "venue");
  const expected = ctx.inheritedRefs.planningPlaybookTemplateId;
  const expectedVenue = ctx.inheritedRefs.venuePlanningPlaybookTemplateId;
  const expectedName = ctx.templateNames.planning;

  if (!client) {
    if (expected) {
      return {
        status: "draft",
        summary: expectedName
          ? `Configured checklist "${expectedName}" is recoverable on Release to client portal. Open Planning to review once present.`
          : "Configured client checklist is recoverable on Release to client portal. Open Planning to review once present.",
        nextAction: "Open Planning",
      };
    }
    return {
      status: "needs_action",
      summary: "No client planning checklist on this event yet.",
      nextAction: "Open Planning",
    };
  }

  let venueNote = "";
  if (venue) {
    venueNote = " Venue-team checklist is on the event and stays internal.";
  } else if (expectedVenue) {
    venueNote = " Configured venue checklist was not applied — Release to client portal recovers it.";
  }

  if (!client.releasedAt) {
    return {
      status: "draft",
      summary: `The client checklist "${client.templateName}" is prepared but has not yet been released to the client. Use Change for this event to customize it, then Release to client portal from Overview when ready.${venueNote}`,
      nextAction: "Open Planning",
    };
  }

  return {
    status: "shared",
    summary: `The client checklist "${client.templateName}" has been released to the client.${venueNote}`,
    nextAction: "Open Planning",
  };
}

function timelineDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  const expectedName = ctx.templateNames.timeline;
  if (!ctx.hasTimeline) {
    if (ctx.inheritedRefs.timelineTemplateId) {
      return {
        status: "draft",
        summary: expectedName
          ? `Configured timeline "${expectedName}" is recoverable on Release to client portal.`
          : "Configured timeline template is recoverable on Release to client portal.",
        nextAction: "Open Timeline",
      };
    }
    return {
      status: "needs_action",
      summary: "No event timeline yet.",
      nextAction: "Open Timeline",
    };
  }
  return {
    status: "included",
    summary: `${ctx.timelineItemCount} timeline item${ctx.timelineItemCount === 1 ? "" : "s"} on this event${expectedName ? ` (started from ${expectedName})` : ""}. Shared with the client when you Release to client portal.`,
    nextAction: "Open Timeline",
  };
}

function floorPlansDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  const preferred = ctx.preferredFloorPlanName;
  if (ctx.floorPlanOfferCount === 0) {
    if (ctx.inheritedRefs.defaultFloorPlanTemplateId || (ctx.inheritedRefs.floorPlanTemplateIds?.length ?? 0) > 0) {
      return {
        status: "draft",
        summary: "Configured floor-plan options are recoverable on Release to client portal.",
        nextAction: "Open Floor Plans",
      };
    }
    return {
      status: "needs_action",
      summary: "No floor-plan layouts offered to the client yet. Offered layouts are separate from the venue's operational layout.",
      nextAction: "Open Floor Plans",
    };
  }
  return {
    status: "included",
    summary: `${ctx.floorPlanOfferCount} layout${ctx.floorPlanOfferCount === 1 ? "" : "s"} offered to the client${preferred ? ` · preferred starting: ${preferred}` : ""}. Offered layouts are not the operational layout.`,
    nextAction: "Open Floor Plans",
  };
}

function vendorsDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  const rec = ctx.vendorRecommendationCount;
  return {
    status: "included",
    summary:
      `Vendor Network classifications (preferred, recommended, required) are authoritative. ` +
      `Eligible vendors are available for client discovery by default. ` +
      (rec > 0
        ? `${rec} optional highlight${rec === 1 ? "" : "s"} on this event. `
        : "") +
      "Required vendors keep their existing assignment behavior.",
    nextAction: "Open Vendors",
  };
}

function questionnairesDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  const expected = ctx.inheritedRefs.questionnaireTemplateIds ?? [];
  const qs = ctx.questionnaires;
  if (qs.length === 0) {
    if (expected.length > 0) {
      return {
        status: "draft",
        summary: `${expected.length} questionnaire template${expected.length === 1 ? "" : "s"} selected in the Setup Profile, but no event draft has been created yet. Drafts are created at booking when possible. Staff send questionnaires with an explicit authorized send — portal release does not send them, and there is no automated delivery schedule.`,
        nextAction: "Open Questionnaires",
      };
    }
    return {
      status: "included",
      summary:
        "Questionnaires stay separate from portal release. Staff create drafts and send them with an authorized send when ready — there is no automated delivery schedule.",
      nextAction: "Open Questionnaires",
    };
  }

  const drafts = qs.filter((q) => q.status === "draft");
  const sent = qs.filter((q) => q.status !== "draft");
  if (sent.length === 0) {
    return {
      status: "draft",
      summary: `${drafts.length} questionnaire draft${drafts.length === 1 ? "" : "s"} on this event. Send with an authorized send when ready — not sent by portal release, and not on an automated schedule.`,
      nextAction: "Open Questionnaires",
    };
  }
  if (drafts.length > 0) {
    return {
      status: "shared",
      summary: `${sent.length} sent · ${drafts.length} still draft (drafts stay private until staff send them). Separate from portal release.`,
      nextAction: "Open Questionnaires",
    };
  }
  return {
    status: "shared",
    summary: `${sent.length} questionnaire${sent.length === 1 ? "" : "s"} sent to the client. Separate from portal release.`,
    nextAction: "Open Questionnaires",
  };
}

function inventoryDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  const name = ctx.templateNames.inventory;
  const hasRef = Boolean(name || ctx.inheritedRefs.inventoryTemplateId);
  if (!ctx.hasEventInventory) {
    if (hasRef) {
      return {
        status: "draft",
        summary: `Starting offering "${name ?? "selected"}" is configured. The event inventory draft is recoverable on Release to client portal — there is no separate inventory prepare step. Does not share with the couple or create invoices.`,
        nextAction: "Open Inventory",
      };
    }
    return {
      status: "needs_action",
      summary:
        "Inventory is included, but this event's Setup Profile has no starting offering selected. Edit Setup Profiles to choose a template, or Skip this area if inventory is not needed.",
      nextAction: "Open Setup Profiles",
    };
  }
  return {
    status: "included",
    summary: "Event inventory draft is prepared for this event. Not shared with the couple and not an invoice.",
    nextAction: "Open Inventory",
  };
}

function eventOrderDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  const name = ctx.templateNames.eventOrder;
  const order = ctx.eventOrder;
  if (!order) {
    const hasRef = Boolean(name || ctx.inheritedRefs.eventOrderTemplateId);
    if (hasRef) {
      return {
        status: "draft",
        summary: `Starting package "${name ?? "selected"}" is configured. The Event Order draft is recoverable on Release to client portal — there is no separate Event Order prepare step. Not an invoice, contract, or payment plan.`,
        nextAction: "Open Event Order",
      };
    }
    return {
      status: "needs_action",
      summary:
        "Event Order is included, but this event's Setup Profile has no starting package selected. Edit Setup Profiles to choose a package, or Skip this area for package-only events.",
      nextAction: "Open Setup Profiles",
    };
  }
  if (order.sharedAt) {
    return {
      status: "shared",
      summary: `Event Order (${order.status}) has been shared with the client.`,
      nextAction: "Open Event Order",
    };
  }
  return {
    status: "draft",
    summary: `Event Order draft exists (${order.status}) — not yet shared. Not an invoice or payment plan. Sharing stays separate from portal release.`,
    nextAction: "Open Event Order",
  };
}

export function setupReadinessDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  if (ctx.decision === "skipped") {
    return {
      status: "not_included",
      summary: "Not included for this event. The client should not expect this tool.",
      nextAction: null,
    };
  }
  if (ctx.decision !== "set_up") {
    return {
      status: "needs_action",
      summary: "Decide whether this area is included for this event.",
      nextAction: "Set up or Skip",
    };
  }

  switch (ctx.step) {
    case "planning":
      return planningDetail(ctx);
    case "timeline":
      return timelineDetail(ctx);
    case "floor_plans":
      return floorPlansDetail(ctx);
    case "vendors":
      return vendorsDetail(ctx);
    case "questionnaires":
      return questionnairesDetail(ctx);
    case "inventory":
      return inventoryDetail(ctx);
    case "event_order":
      return eventOrderDetail(ctx);
    case "portal":
      return {
        status: "included",
        summary: "Client invitation uses the existing portal invitation flow.",
        nextAction: "Invite client",
      };
    default:
      return {
        status: "included",
        summary: "Included for this event.",
        nextAction: null,
      };
  }
}
