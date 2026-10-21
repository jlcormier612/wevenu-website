/**
 * Booked-event readiness row detail — derived only from persisted decisions
 * and verified artifact state. Does not invent completion from mere record
 * existence without the matching lifecycle field (released/sent/shared).
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
  const expectedName = ctx.templateNames.planning;

  if (!client) {
    if (expected) {
      return {
        status: "unavailable",
        summary: expectedName
          ? `Configured checklist "${expectedName}" was not applied to this event.`
          : "Configured client checklist was not applied to this event.",
        nextAction: "Open Planning to apply the checklist",
      };
    }
    return {
      status: "needs_action",
      summary: "No client planning checklist on this event yet.",
      nextAction: "Open Planning to apply a checklist",
    };
  }

  const venueNote = venue
    ? " Venue-team checklist is separate and stays internal."
    : "";

  if (!client.releasedAt) {
    return {
      status: "draft",
      summary: `Client checklist "${client.templateName}" is a draft — not yet visible to the client.${venueNote}`,
      nextAction: "Open Planning to edit or release",
    };
  }

  return {
    status: "shared",
    summary: `Client checklist "${client.templateName}" is released to the client.${venueNote}`,
    nextAction: "Open Planning",
  };
}

function timelineDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  const expectedName = ctx.templateNames.timeline;
  if (!ctx.hasTimeline) {
    if (ctx.inheritedRefs.timelineTemplateId) {
      return {
        status: "unavailable",
        summary: expectedName
          ? `Configured timeline "${expectedName}" was not applied.`
          : "Configured timeline template was not applied.",
        nextAction: "Open Timeline to apply the starting schedule",
      };
    }
    return {
      status: "needs_action",
      summary: "No event timeline yet.",
      nextAction: "Open Timeline to apply a template or build the schedule",
    };
  }
  return {
    status: "included",
    summary: `${ctx.timelineItemCount} timeline item${ctx.timelineItemCount === 1 ? "" : "s"} on this event${expectedName ? ` (started from ${expectedName})` : ""}. Sharing with the client is a separate action.`,
    nextAction: "Open Timeline",
  };
}

function floorPlansDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  const preferred = ctx.preferredFloorPlanName;
  if (ctx.floorPlanOfferCount === 0) {
    if (ctx.inheritedRefs.defaultFloorPlanTemplateId || (ctx.inheritedRefs.floorPlanTemplateIds?.length ?? 0) > 0) {
      return {
        status: "unavailable",
        summary: "Configured floor-plan options were not offered on this event.",
        nextAction: "Open Floor Plans to offer layouts",
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
  const expectedRecs = ctx.inheritedRefs.recommendedVendorIds ?? [];
  if (expectedRecs.length > 0 && rec === 0) {
    return {
      status: "unavailable",
      summary:
        "This event’s Setup Profile listed recommended vendors, but none were attached. Recommendations are separate from operational assignments.",
      nextAction: "Open Vendors to recommend",
    };
  }
  return {
    status: "included",
    summary:
      `Eligible vendors from your Vendor Network are available for client discovery by default. ` +
      (rec > 0
        ? `${rec} optional recommendation${rec === 1 ? "" : "s"} highlighted for this event. `
        : "No optional recommendations highlighted (that is fine — recommendations are optional). ") +
      "Required vendors are managed in Vendor Network and assigned separately.",
    nextAction: "Open Vendors",
  };
}

function questionnairesDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  const expected = ctx.inheritedRefs.questionnaireTemplateIds ?? [];
  const qs = ctx.questionnaires;
  if (qs.length === 0) {
    if (expected.length > 0) {
      return {
        status: "unavailable",
        summary: `${expected.length} questionnaire${expected.length === 1 ? "" : "s"} were configured to prepare but no drafts exist on this event.`,
        nextAction: "Open Questionnaires to prepare drafts",
      };
    }
    return {
      status: "needs_action",
      summary: "No questionnaires prepared yet. Drafts are not visible to the client until sent.",
      nextAction: "Open Questionnaires",
    };
  }

  const drafts = qs.filter((q) => q.status === "draft");
  const sent = qs.filter((q) => q.status !== "draft");
  if (sent.length === 0) {
    return {
      status: "draft",
      summary: `${drafts.length} questionnaire draft${drafts.length === 1 ? "" : "s"} prepared — not visible to the client until sent.`,
      nextAction: "Open Questionnaires to preview or send",
    };
  }
  if (drafts.length > 0) {
    return {
      status: "shared",
      summary: `${sent.length} sent · ${drafts.length} still draft (drafts stay private until sent).`,
      nextAction: "Open Questionnaires",
    };
  }
  return {
    status: "shared",
    summary: `${sent.length} questionnaire${sent.length === 1 ? "" : "s"} sent to the client.`,
    nextAction: "Open Questionnaires",
  };
}

function inventoryDetail(ctx: SetupReadinessContext): SetupReadinessDetail {
  const name = ctx.templateNames.inventory;
  const hasRef = Boolean(name || ctx.inheritedRefs.inventoryTemplateId);
  if (!ctx.hasEventInventory) {
    if (hasRef) {
      return {
        status: "needs_action",
        summary: `Profile starting offering "${name ?? "selected"}" is ready to apply as an event inventory draft. Booking did not create inventory — start when you are ready. Does not share with the couple or create invoices.`,
        nextAction: name ? `Start "${name}" inventory draft` : "Start inventory draft from profile",
      };
    }
    return {
      status: "needs_action",
      summary:
        "Inventory is included, but this event's Setup Profile has no starting offering selected. Edit Setup Profiles to choose a template, or start blank from Inventory. If this event does not need inventory, Skip this area. Booking never creates inventory automatically.",
      nextAction: "Open Setup Profiles",
    };
  }
  return {
    status: "included",
    summary: "Event inventory is set for this event. This is operational inventory, not a financial commitment by itself.",
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
        status: "needs_action",
        summary: `Profile package "${name ?? "selected"}" is ready to apply as an Event Order draft. Booking did not start an order — this is not an invoice, contract, or payment plan, and is not shared until you share it.`,
        nextAction: name ? `Start "${name}" Event Order draft` : "Start Event Order draft from profile",
      };
    }
    return {
      status: "needs_action",
      summary:
        "Event Order is included, but this event's Setup Profile has no starting package selected. Edit Setup Profiles to choose a package, or start one from Event Order. If this booking is package-only and does not need a detailed Event Order, Skip this area instead.",
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
    summary: `Event Order exists (${order.status}) — not yet shared with the client. Not an invoice or payment plan.`,
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
        nextAction: "Invite client to workspace",
      };
    default:
      return {
        status: "included",
        summary: "Included for this event.",
        nextAction: null,
      };
  }
}
