/**
 * Venue Home — Your Next Steps.
 *
 * An actionable, state-driven queue. Not onboarding, not a discovery carousel.
 * Task-derived rows read existing event_tasks (Task Center). Portal invite vs
 * unopened portal is one lifecycle, never two simultaneous items.
 */
import {
  formatNextStepsDueLabel,
  sortNextStepsWithinGroup,
} from "@/lib/portal/next-steps";

export const VENUE_NEXT_STEPS_CAP = 5;

/**
 * The Dashboard page fetches at this larger cap, filters out anything
 * already shown in Today's Focus, then caps to VENUE_NEXT_STEPS_CAP for
 * display — so a next step already claimed by Today's Focus can't shrink
 * what's actually visible below 5 genuinely-different items.
 */
export const VENUE_NEXT_STEPS_CANDIDATE_CAP = 25;

export type VenueNextStepsPriority = "venue" | "shared";

export type VenueNextStep = {
  id: string;
  /** Dedup key — resolved before the 5-item cap. */
  subjectKey: string;
  priority: VenueNextStepsPriority;
  title: string;
  description: string;
  context: string | null;
  dueDate: string | null;
  isOverdue: boolean;
  ctaLabel: string;
  href: string;
};

export type PortalClientInput = {
  id: string;
  status: string;
  name: string;
  invitationSent: boolean;
  portalOpened: boolean;
};

export type VenueTaskInput = {
  id: string;
  title: string;
  dueDate: string | null;
  eventId: string;
  eventName: string | null;
  clientName: string | null;
  ownerType: "coordinator" | "team" | "couple" | "vendor";
  status: string;
};

export type LeadFollowUpInput = {
  id: string;
  name: string;
  followUpDate: string | null;
  isOverdue: boolean;
};

export type ContractInput = {
  id: string;
  title: string;
  status: "draft" | "sent" | "signed" | "cancelled" | "expired";
  clientName: string | null;
};

export type PaymentInput = {
  id: string;
  scheduleId: string;
  label: string;
  dueDate: string;
  isOverdue: boolean;
  clientName: string | null;
};

export type VenueNextStepsSnapshot = {
  today: string;
  clients: PortalClientInput[];
  venueTasks: VenueTaskInput[];
  leadFollowUps: LeadFollowUpInput[];
  contracts?: ContractInput[];
  payments?: PaymentInput[];
};

export const PORTAL_INVITE_TITLE = "Invite your couple to their portal";
export const PORTAL_INVITE_DESCRIPTION =
  "The portal gives your couple their shared planning workspace.";
export const PORTAL_INVITE_CTA = "Invite couple →";

export const PORTAL_UNOPENED_TITLE = "Your couple hasn't opened their portal yet";
export const PORTAL_UNOPENED_DESCRIPTION =
  "You've sent the invitation. Once they open their portal, you'll be able to work together on planning.";
export const PORTAL_UNOPENED_CTA = "View client →";

export type PortalLifecycle = "invite" | "unopened" | "opened" | "none";

/** One lifecycle per booked client. Invite and unopened never coexist. */
export function portalLifecycleForClient(client: PortalClientInput): PortalLifecycle {
  if (client.status === "cancelled") return "none";
  if (client.portalOpened) return "opened";
  if (client.invitationSent) return "unopened";
  return "invite";
}

function isOpenTaskStatus(status: string): boolean {
  return status === "pending" || status === "overdue" || status === "blocked";
}

function taskIsOverdue(task: VenueTaskInput, today: string): boolean {
  if (task.status === "overdue") return true;
  return !!task.dueDate && task.dueDate < today && isOpenTaskStatus(task.status);
}

function dedupe(items: VenueNextStep[]): VenueNextStep[] {
  const seen = new Set<string>();
  const out: VenueNextStep[] = [];
  for (const item of items) {
    if (seen.has(item.subjectKey)) continue;
    seen.add(item.subjectKey);
    out.push(item);
  }
  return out;
}

function portalItems(clients: PortalClientInput[]): VenueNextStep[] {
  const items: VenueNextStep[] = [];
  for (const client of clients) {
    const life = portalLifecycleForClient(client);
    if (life === "invite") {
      items.push({
        id: `portal-invite-${client.id}`,
        subjectKey: `portal:${client.id}`,
        priority: "venue",
        title: PORTAL_INVITE_TITLE,
        description: PORTAL_INVITE_DESCRIPTION,
        context: client.name,
        dueDate: null,
        isOverdue: false,
        ctaLabel: PORTAL_INVITE_CTA,
        href: `/clients/${client.id}`,
      });
    } else if (life === "unopened") {
      items.push({
        id: `portal-unopened-${client.id}`,
        subjectKey: `portal:${client.id}`,
        priority: "shared",
        title: PORTAL_UNOPENED_TITLE,
        description: PORTAL_UNOPENED_DESCRIPTION,
        context: client.name,
        dueDate: null,
        isOverdue: false,
        ctaLabel: PORTAL_UNOPENED_CTA,
        href: `/clients/${client.id}`,
      });
    }
  }
  return items;
}

function taskItems(tasks: VenueTaskInput[], today: string): VenueNextStep[] {
  const items: VenueNextStep[] = [];
  for (const task of tasks) {
    if (!isOpenTaskStatus(task.status)) continue;
    // P3 personal todos stay off this list. Vendor-owned work is the vendor's
    // execution surface, not a venue Home item.
    if (task.ownerType === "vendor") continue;

    const overdue = taskIsOverdue(task, today);
    const context = [task.clientName, task.eventName].filter(Boolean).join(" · ") || null;

    if (task.ownerType === "couple") {
      items.push({
        id: `task-${task.id}`,
        subjectKey: `task:${task.id}`,
        priority: "shared",
        title: task.title,
        description: "Shared planning that still needs attention.",
        context,
        dueDate: task.dueDate,
        isOverdue: overdue,
        ctaLabel: "View event →",
        href: `/events/${task.eventId}`,
      });
      continue;
    }

    items.push({
      id: `task-${task.id}`,
      subjectKey: `task:${task.id}`,
      priority: "venue",
      title: task.title,
      description: overdue
        ? "This is waiting on your team — no rush-shame, just still open."
        : "A venue task that still needs to be done.",
      context,
      dueDate: task.dueDate,
      isOverdue: overdue,
      ctaLabel: "Open task →",
      href: `/tasks`,
    });
  }
  return items;
}

function leadItems(leads: LeadFollowUpInput[], today: string): VenueNextStep[] {
  return leads.map((lead) => {
    const overdue = lead.isOverdue || (!!lead.followUpDate && lead.followUpDate < today);
    return {
      id: `lead-${lead.id}`,
      subjectKey: `lead:${lead.id}`,
      priority: "venue" as const,
      title: `Follow up with ${lead.name}`,
      description: overdue
        ? "This follow-up is past due — a short check-in keeps the conversation going."
        : "This lead is waiting on a next step from you.",
      context: lead.name,
      dueDate: lead.followUpDate,
      isOverdue: overdue,
      ctaLabel: "View lead →",
      href: `/leads/${lead.id}`,
    };
  });
}

function contractItems(contracts: ContractInput[]): VenueNextStep[] {
  const items: VenueNextStep[] = [];
  for (const contract of contracts) {
    if (contract.status === "draft") {
      items.push({
        id: `contract-send-${contract.id}`,
        subjectKey: `contract:${contract.id}`,
        priority: "venue",
        title: "Send contract",
        description: "This agreement is still a draft — it needs to go out before anyone can sign.",
        context: contract.clientName ?? contract.title,
        dueDate: null,
        isOverdue: false,
        ctaLabel: "Open contract →",
        href: `/contracts/${contract.id}`,
      });
    } else if (contract.status === "sent") {
      items.push({
        id: `contract-sign-${contract.id}`,
        subjectKey: `contract:${contract.id}`,
        priority: "shared",
        title: "Contract waiting on a signature",
        description: "You've sent the contract. Once it's signed, this booking is fully in place.",
        context: contract.clientName ?? contract.title,
        dueDate: null,
        isOverdue: false,
        ctaLabel: "View contract →",
        href: `/contracts/${contract.id}`,
      });
    }
  }
  return items;
}

function paymentItems(payments: PaymentInput[], today: string): VenueNextStep[] {
  return payments
    .filter((p) => p.isOverdue || p.dueDate < today)
    .map((p) => ({
      id: `payment-${p.id}`,
      subjectKey: `payment:${p.scheduleId}`,
      priority: "venue" as const,
      title: p.label,
      description: "A payment still needs your attention.",
      context: p.clientName,
      dueDate: p.dueDate,
      isOverdue: true,
      ctaLabel: "View payment →",
      href: `/payments/${p.scheduleId}`,
    }));
}

/** All eligible candidates, duplicates removed, not yet capped. */
export function collectVenueNextSteps(snapshot: VenueNextStepsSnapshot): VenueNextStep[] {
  return dedupe([
    ...portalItems(snapshot.clients),
    ...taskItems(snapshot.venueTasks, snapshot.today),
    ...leadItems(snapshot.leadFollowUps, snapshot.today),
    ...contractItems(snapshot.contracts ?? []),
    ...paymentItems(snapshot.payments ?? [], snapshot.today),
  ]);
}

/**
 * P1 (From your venue) then P2 (Shared planning). Within a group:
 * overdue → today → tomorrow → soonest → undated. Cap 5.
 * Personal todos are never collected.
 */
export function selectVenueNextSteps(
  items: VenueNextStep[],
  cap = VENUE_NEXT_STEPS_CAP,
  today?: string,
): { visible: VenueNextStep[]; total: number } {
  const venue = sortNextStepsWithinGroup(
    items.filter((i) => i.priority === "venue"),
    today,
  );
  const shared = sortNextStepsWithinGroup(
    items.filter((i) => i.priority === "shared"),
    today,
  );
  const ordered = [...venue, ...shared];
  return { visible: ordered.slice(0, Math.max(0, cap)), total: ordered.length };
}

export function resolveVenueNextSteps(
  snapshot: VenueNextStepsSnapshot,
  cap = VENUE_NEXT_STEPS_CAP,
): {
  visible: VenueNextStep[];
  total: number;
} {
  return selectVenueNextSteps(collectVenueNextSteps(snapshot), cap, snapshot.today);
}

/**
 * Exclude anything that belongs in Today's Focus (NOW) from Your Next Steps (NEXT).
 *
 * Rules:
 * 1. Overdue or due-today items are today's urgent work — never Next Steps.
 * 2. Any subject already represented in Today's Focus is excluded — via
 *    ClassifiedItem.crossSectionSubject, the real underlying entity a
 *    Today's Focus item is about (set only where confirmed correct — see
 *    that field's own doc comment for exactly which entities are and are
 *    not matched, and why). Never derived by guessing at another section's
 *    id format: a Today's Focus "task-" item is a lead_tasks row; a Your
 *    Next Steps "task:" item is an event_tasks row — different tables that
 *    happen to share a word, not the same entity, so they are never
 *    conflated here.
 *
 * Call this with the FULL (uncapped) Your Next Steps candidate list — i.e.
 * resolveVenueNextSteps's `visible` at a cap generous enough that Today's
 * Focus overlap doesn't quietly shrink what Your Next Steps can show.
 * Capping to VENUE_NEXT_STEPS_CAP happens after this filter, not before,
 * so a lead already shown in Today's Focus can't silently use up one of
 * only 5 slots and crowd out a genuinely different next step.
 */
export function excludeTodayFocusFromNextSteps(
  nextSteps: VenueNextStep[],
  focusItems: { crossSectionSubject: string | null }[],
  today: string,
): VenueNextStep[] {
  const focusSubjects = new Set<string>();
  for (const item of focusItems) {
    if (item.crossSectionSubject) focusSubjects.add(item.crossSectionSubject);
  }

  return nextSteps.filter((step) => {
    if (step.isOverdue) return false;
    if (step.dueDate && step.dueDate <= today) return false;
    if (focusSubjects.has(step.subjectKey)) return false;
    return true;
  });
}

export function groupVenueNextSteps(visible: VenueNextStep[]): {
  venue: VenueNextStep[];
  shared: VenueNextStep[];
} {
  return {
    venue: visible.filter((i) => i.priority === "venue"),
    shared: visible.filter((i) => i.priority === "shared"),
  };
}

export function venueNextStepDueLabel(item: VenueNextStep, today: string): string | null {
  return formatNextStepsDueLabel(item.dueDate, item.isOverdue, today);
}
