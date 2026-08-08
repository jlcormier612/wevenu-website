/**
 * Couple Home — Your Wedding launch presentation.
 *
 * Curated invitations into existing couple-owned destinations.
 * Status lines reuse live summary inputs already available on Home.
 * No new progress formulas, RSVP analytics, or financial calculations.
 */

import type { PortalSection } from "@/lib/portal/types";

export type WeddingLaunchTone = "invite" | "active" | "complete";

export type WeddingLaunchModel = {
  label: string;
  /** Warm status / invite line — never "No data" / "0 items". */
  status: string;
  /** Single clear CTA into the destination SoT. */
  cta: string;
  destination: PortalSection;
  tone: WeddingLaunchTone;
  /** Full accessible name for the card button. */
  accessibleLabel: string;
};

export function formatBudgetMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Existing website Studio % — completed sections / ALL_SECTIONS length. */
export function websiteCompletionPercent(
  completedSections: number,
  totalSections: number,
): number {
  if (totalSections <= 0) return 0;
  return Math.round((completedSections / totalSections) * 100);
}

export function resolveWebsiteLaunch(input: {
  exists: boolean;
  isPublished: boolean;
  completedSections: number;
  totalSections: number;
}): WeddingLaunchModel {
  const label = "Wedding Website";
  const destination: PortalSection = "website";
  const cta = "Open Website";

  if (!input.exists) {
    return {
      label,
      status: "Start your wedding website",
      cta,
      destination,
      tone: "invite",
      accessibleLabel: `${label}. Start your wedding website. ${cta}`,
    };
  }

  if (input.isPublished) {
    return {
      label,
      status: "Published ✓",
      cta,
      destination,
      tone: "complete",
      accessibleLabel: `${label}. Published. ${cta}`,
    };
  }

  const percent = websiteCompletionPercent(input.completedSections, input.totalSections);
  const status = `${percent}% complete`;
  return {
    label,
    status,
    cta,
    destination,
    tone: percent > 0 ? "active" : "invite",
    accessibleLabel: `${label}. ${status}. ${cta}`,
  };
}

export function resolveGuestsLaunch(input: {
  total: number;
  attending: number;
} | null): WeddingLaunchModel {
  const label = "Guest List";
  const destination: PortalSection = "guests";
  const cta = "Open Guest List";

  if (!input || input.total <= 0) {
    return {
      label,
      status: "Begin your guest list",
      cta,
      destination,
      tone: "invite",
      accessibleLabel: `${label}. Begin your guest list. ${cta}`,
    };
  }

  const status = `${input.total} invited, ${input.attending} confirmed`;
  return {
    label,
    status,
    cta,
    destination,
    tone: "active",
    accessibleLabel: `${label}. ${status}. ${cta}`,
  };
}

export function resolveBudgetLaunch(input: {
  totalBudget: number;
  spent: number;
} | null): WeddingLaunchModel {
  const label = "Budget";
  const destination: PortalSection = "budget";
  const cta = "Open Budget";

  if (!input || input.totalBudget <= 0) {
    return {
      label,
      status: "Set a budget whenever you’re ready",
      cta,
      destination,
      tone: "invite",
      accessibleLabel: `${label}. Set a budget whenever you’re ready. ${cta}`,
    };
  }

  const status = `${formatBudgetMoney(input.spent)} of ${formatBudgetMoney(input.totalBudget)}`;
  return {
    label,
    status,
    cta,
    destination,
    tone: "active",
    accessibleLabel: `${label}. ${status}. ${cta}`,
  };
}

export function resolveSeatingLaunch(input: {
  hasFloorPlan: boolean;
  hadPriorWork: boolean;
  unassignedCount: number;
} | null): WeddingLaunchModel {
  const label = "Seating";
  const destination: PortalSection = "seating";
  const cta = "Open Seating";

  if (!input || !input.hasFloorPlan) {
    const status =
      input?.hadPriorWork
        ? "Your seating plan will appear when your venue shares it again"
        : "Arrange your celebration seating when you’re ready";
    return {
      label,
      status,
      cta,
      destination,
      tone: "invite",
      accessibleLabel: `${label}. ${status}. ${cta}`,
    };
  }

  if (input.unassignedCount > 0) {
    const n = input.unassignedCount;
    const status = `${n} guest${n === 1 ? "" : "s"} unassigned`;
    return {
      label,
      status,
      cta,
      destination,
      tone: "active",
      accessibleLabel: `${label}. ${status}. ${cta}`,
    };
  }

  return {
    label,
    status: "All guests seated ✓",
    cta,
    destination,
    tone: "complete",
    accessibleLabel: `${label}. All guests seated. ${cta}`,
  };
}

/**
 * Plans summary: prefer existing inspiration-photo count, else incomplete
 * personal todos (loaded on cold Home). Personal todos never go to Next Steps.
 */
export function resolvePlansLaunch(input: {
  ideaCount: number;
  todoCount: number;
}): WeddingLaunchModel {
  const label = "Plans";
  const destination: PortalSection = "todos";
  const cta = "Continue Plans";

  if (input.ideaCount > 0) {
    const n = input.ideaCount;
    const status = `${n} saved idea${n === 1 ? "" : "s"}`;
    return {
      label,
      status,
      cta,
      destination,
      tone: "active",
      accessibleLabel: `${label}. ${status}. ${cta}`,
    };
  }

  if (input.todoCount > 0) {
    const n = input.todoCount;
    const status = `${n} on your list`;
    return {
      label,
      status,
      cta,
      destination,
      tone: "active",
      accessibleLabel: `${label}. ${status}. ${cta}`,
    };
  }

  return {
    label,
    status: "Keep your personal planning notes here",
    cta,
    destination,
    tone: "invite",
    accessibleLabel: `${label}. Keep your personal planning notes here. ${cta}`,
  };
}

export function resolveStoryLaunch(input: { ourStory: string | null | undefined }): WeddingLaunchModel {
  const label = "Our Story";
  const destination: PortalSection = "story";
  const cta = "Open Our Story";
  const written = Boolean(input.ourStory?.trim());

  if (written) {
    return {
      label,
      status: "Written ✓",
      cta,
      destination,
      tone: "complete",
      accessibleLabel: `${label}. Written. ${cta}`,
    };
  }

  return {
    label,
    status: "Start your story",
    cta,
    destination,
    tone: "invite",
    accessibleLabel: `${label}. Start your story. ${cta}`,
  };
}
