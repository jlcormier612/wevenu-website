/**
 * Phase 1 booking handoff — presentation only.
 *
 * Derives factual checklist state from records that already exist.
 * Does not decide whether contract, deposit, or a payment plan is required.
 * Communications and invitation copy live on the Communications review
 * model; this checklist only shows that review's summary.
 */

import type { ContractExecutionOrigin, ContractStatus } from "@/lib/contracts/types";
import type { PlaybookKind } from "@/lib/playbooks/types";

export type BookingHandoffPlaybook = {
  kind: PlaybookKind;
  releasedAt: string | null;
  templateName: string;
};

export type BookingHandoffContract = {
  id: string;
  status: ContractStatus;
  executionOrigin?: ContractExecutionOrigin;
};

export type BookingHandoffInput = {
  clientId: string;
  eventId: string | null;
  playbookApplications: BookingHandoffPlaybook[];
  financialSummary: string;
  communicationsSummary: string;
  experienceSummary: string;
};

export type BookingHandoffItem = {
  key: string;
  label: string;
  detail: string;
  complete: boolean;
  href: string;
  actionLabel: string;
};

export type BookingHandoffModel = {
  eyebrow: string;
  bookingLine: string;
  prepareHeading: string;
  tagline: string;
  primaryHref: string;
  primaryLabel: string;
  items: BookingHandoffItem[];
};

const CONTRACT_STATUS_ORDER: ContractStatus[] = [
  "signed",
  "sent",
  "draft",
  "expired",
  "cancelled",
];

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  signed: "Signed",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function pickContract(contracts: BookingHandoffContract[]): BookingHandoffContract | null {
  if (contracts.length === 0) return null;
  return [...contracts].sort(
    (a, b) => CONTRACT_STATUS_ORDER.indexOf(a.status) - CONTRACT_STATUS_ORDER.indexOf(b.status),
  )[0] ?? null;
}

function planningHref(clientId: string, eventId: string | null): string {
  return eventId ? `/events/${eventId}#playbook` : `/clients/${clientId}/edit`;
}

function clientPlanningItem(
  clientId: string,
  eventId: string | null,
  applications: BookingHandoffPlaybook[],
): BookingHandoffItem {
  const href = planningHref(clientId, eventId);
  const app = applications.find((a) => a.kind === "client");
  if (!app) {
    return {
      key: "client_planning",
      label: "Client Planning",
      detail: "Not configured",
      complete: false,
      href,
      actionLabel: eventId ? "Open Planning" : "Add event details",
    };
  }
  if (!app.releasedAt) {
    return {
      key: "client_planning",
      label: "Client Planning",
      detail: "Draft — not yet released to the client",
      complete: true,
      href,
      actionLabel: "Open Planning",
    };
  }
  return {
    key: "client_planning",
    label: "Client Planning",
    detail: `Released to the client — ${app.templateName}`,
    complete: true,
    href,
    actionLabel: "Open Planning",
  };
}

function venuePlanningItem(
  clientId: string,
  eventId: string | null,
  applications: BookingHandoffPlaybook[],
): BookingHandoffItem {
  const href = planningHref(clientId, eventId);
  const app = applications.find((a) => a.kind === "venue");
  if (!app) {
    return {
      key: "venue_planning",
      label: "Venue Planning",
      detail: "Not configured",
      complete: false,
      href,
      actionLabel: eventId ? "Open Planning" : "Add event details",
    };
  }
  return {
    key: "venue_planning",
    label: "Venue Planning",
    detail: `Configured — ${app.templateName}`,
    complete: true,
    href,
    actionLabel: "Open Planning",
  };
}

export function buildBookingHandoff(input: BookingHandoffInput): BookingHandoffModel {
  const { clientId, eventId, playbookApplications, financialSummary, communicationsSummary, experienceSummary } = input;
  const clientPlanning = clientPlanningItem(clientId, eventId, playbookApplications);
  const venuePlanning = venuePlanningItem(clientId, eventId, playbookApplications);

  const items: BookingHandoffItem[] = [
    {
      key: "client",
      label: "Client created",
      detail: "Their Client record is in place.",
      complete: true,
      href: `/clients/${clientId}`,
      actionLabel: "View Client",
    },
    eventId
      ? {
          key: "event",
          label: "Event created",
          detail: "A draft Event exists for this booking.",
          complete: true,
          href: `/events/${eventId}`,
          actionLabel: "Open Event",
        }
      : {
          key: "event",
          label: "Event created",
          detail: "No event yet — add a date to create one.",
          complete: false,
          href: `/clients/${clientId}/edit`,
          actionLabel: "Add event details",
        },
    clientPlanning,
    venuePlanning,
    {
      key: "financial",
      label: "Financial readiness",
      detail: financialSummary,
      complete: false,
      href: "#financial-readiness",
      actionLabel: "Review",
    },
    {
      key: "event_experience",
      label: "Event Experience",
      detail: experienceSummary,
      complete: false,
      href: "#event-experience",
      actionLabel: "Review",
    },
    {
      key: "communications",
      label: "Communications",
      detail: communicationsSummary,
      complete: false,
      href: "#communications",
      actionLabel: "Review",
    },
  ];

  return {
    eyebrow: "Booking complete",
    bookingLine: "are booked.",
    prepareHeading: "Prepare Their Event",
    tagline: "Their booking is complete. Next, prepare their event.",
    primaryHref: eventId ? `/events/${eventId}#playbook` : `/clients/${clientId}/edit`,
    primaryLabel: eventId ? "Prepare Their Event" : "Add event details",
    items,
  };
}
