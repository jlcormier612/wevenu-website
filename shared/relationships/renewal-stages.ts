/**
 * Subscription-anniversary Customer Success stage automation.
 *
 * Date math (UTC calendar days):
 * - renewalDate = subscribedAt + 1 year (stored; kept in sync when possible)
 * - → renewal  when today ∈ [renewalDate − 60 days, renewalDate]
 * - → renewed  when today ≥ renewalDate + 1 day
 *   (then roll renewalDate forward +1 year for the next cycle)
 *
 * Soft-promote only. Open support pin (`needs_support` / supportOpenCount > 0)
 * wins — auto skips until support clears; next tick applies. Suspended /
 * accessDisabled are never overridden. Manual board moves still force any stage.
 */

import { randomUUID } from "crypto";

import {
  markAutoArrival,
  normalizeCustomerSuccessStage,
  promoteCustomerSuccessStage,
  type CustomerSuccessStage,
} from "./sales-cs";
import { normalizeLifecycleStatus } from "./status";
import { withLiveStore } from "./store";
import type { LiveRelationshipStore, Relationship } from "./types";

const MS_PER_DAY = 86_400_000;

function shortId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** UTC calendar-day epoch (ms at 00:00 UTC). */
export function utcDayMs(isoOrDate: string | Date): number {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return NaN;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function addUtcYearsIso(iso: string, years: number): string {
  const d = new Date(iso);
  return new Date(
    Date.UTC(
      d.getUTCFullYear() + years,
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    ),
  ).toISOString();
}

function dayMsToIso(dayMs: number): string {
  return new Date(dayMs).toISOString();
}

function addDaysMs(dayMs: number, days: number): number {
  return dayMs + days * MS_PER_DAY;
}

function addYearsDayMs(dayMs: number, years: number): number {
  const d = new Date(dayMs);
  return Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate());
}

/** First renewal anniversary: subscribe day + 1 calendar year (UTC). */
export function initialRenewalDateIso(subscribedAt: string): string {
  return addUtcYearsIso(subscribedAt, 1);
}

/**
 * Ensure `renewalDate` is set from `subscribedAt` when missing.
 */
export function syncRenewalDate(
  relationship: Pick<Relationship, "subscribedAt" | "renewalDate"> & {
    renewalDate?: string | null;
  },
): string | null {
  const subscribedAt = relationship.subscribedAt?.trim();
  if (!subscribedAt) return null;

  if (!relationship.renewalDate?.trim()) {
    relationship.renewalDate = initialRenewalDateIso(subscribedAt);
  }
  return relationship.renewalDate;
}

export type RenewalStageTarget = "renewal" | "renewed";

/**
 * Pure window check against a fixed anniversary ISO (does not roll years).
 * - renewed: today >= anniversary + 1 day
 * - renewal: anniversary − 60 days ≤ today ≤ anniversary
 */
export function desiredRenewalStageForAnniversary(
  renewalDateIso: string,
  now: Date = new Date(),
): RenewalStageTarget | null {
  const anniversary = utcDayMs(renewalDateIso);
  const today = utcDayMs(now);
  if (Number.isNaN(anniversary) || Number.isNaN(today)) return null;

  if (today >= addDaysMs(anniversary, 1)) return "renewed";
  if (today >= addDaysMs(anniversary, -60) && today <= anniversary) {
    return "renewal";
  }
  return null;
}

export type ApplyRenewalStageResult = {
  changed: boolean;
  from: CustomerSuccessStage | null;
  to: CustomerSuccessStage | null;
  skipped?: string;
  renewalDate?: string | null;
};

function currentCsStage(
  relationship: Pick<
    Relationship,
    "customerSuccessStage" | "onboardingType" | "status" | "health" | "supportOpenCount"
  >,
): CustomerSuccessStage | null {
  return (
    normalizeCustomerSuccessStage(relationship.customerSuccessStage, relationship) ??
    null
  );
}

function appendAutoStageTimeline(
  store: LiveRelationshipStore,
  relationship: Relationship,
  applied: ApplyRenewalStageResult,
  nowIso: string,
): void {
  if (!applied.changed || !applied.to) return;
  store.timelineEvents.push({
    id: shortId("evt"),
    relationshipId: relationship.id,
    type: applied.to === "renewed" ? "renewal" : "status_changed",
    title:
      applied.to === "renewed" ? "Renewed (auto)" : "Renewal window (auto)",
    body:
      applied.to === "renewed"
        ? `Day after subscription anniversary — Customer Success → renewed. Next renewal ${relationship.renewalDate ?? ""}.`
        : `Within 60 days of renewal (${relationship.renewalDate ?? ""}) — Customer Success → renewal.`,
    occurredAt: nowIso,
    meta: {
      auto: true,
      customer_success_stage: applied.to,
      from_stage: applied.from,
      renewal_date: relationship.renewalDate ?? null,
      subscribed_at: relationship.subscribedAt ?? null,
    },
  });
}

/**
 * Soft-apply anniversary targets on one Relationship (mutates in place).
 */
export function applyRenewalStageEvaluation(
  relationship: Relationship,
  now: Date = new Date(),
): ApplyRenewalStageResult {
  const subscribedAt = relationship.subscribedAt?.trim();
  if (!subscribedAt) {
    return { changed: false, from: null, to: null, skipped: "not_subscribed" };
  }

  const status = normalizeLifecycleStatus(relationship.status);
  if (status === "suspended" || relationship.accessDisabled) {
    return { changed: false, from: null, to: null, skipped: "suspended" };
  }
  if (status === "former_customer") {
    return { changed: false, from: null, to: null, skipped: "former_customer" };
  }

  // Support pin wins — do not yank out of needs_support while open.
  if (
    (relationship.supportOpenCount || 0) > 0 ||
    normalizeCustomerSuccessStage(relationship.customerSuccessStage, relationship) ===
      "needs_support"
  ) {
    syncRenewalDate(relationship);
    return {
      changed: false,
      from: "needs_support",
      to: null,
      skipped: "needs_support_pin",
      renewalDate: relationship.renewalDate,
    };
  }

  syncRenewalDate(relationship);
  let anniversaryDay = utcDayMs(relationship.renewalDate!);
  const today = utcDayMs(now);
  if (Number.isNaN(anniversaryDay) || Number.isNaN(today)) {
    return { changed: false, from: null, to: null, skipped: "invalid_date" };
  }

  const from = currentCsStage(relationship);
  let changed = false;
  let to: CustomerSuccessStage | null = null;
  const nowIso = now.toISOString();

  // Past anniversary + 1 day → soft-promote renewed, then roll renewalDate for next cycle.
  // Catch-up: roll through multiple missed years without revisiting intermediate windows.
  while (today >= addDaysMs(anniversaryDay, 1)) {
    const promoted = promoteCustomerSuccessStage(relationship.customerSuccessStage, "renewed", {
      allowRenewedToRenewal: false,
    });
    if (promoted !== relationship.customerSuccessStage) {
      relationship.customerSuccessStage = promoted;
      markAutoArrival(relationship, "renewed", "cs", nowIso);
      changed = true;
      to = "renewed";
    } else if (promoted === "renewed") {
      to = "renewed";
    }
    anniversaryDay = addYearsDayMs(anniversaryDay, 1);
    relationship.renewalDate = dayMsToIso(anniversaryDay);
  }

  // ≤ 60 days before (and through) the active anniversary → renewal.
  // Allows annual cycle: renewed → renewal once the next window opens.
  if (today >= addDaysMs(anniversaryDay, -60) && today <= anniversaryDay) {
    const prev = relationship.customerSuccessStage;
    const promoted = promoteCustomerSuccessStage(prev, "renewal", {
      allowRenewedToRenewal: true,
    });
    if (promoted !== prev) {
      relationship.customerSuccessStage = promoted;
      markAutoArrival(relationship, "renewal", "cs", nowIso);
      changed = true;
      to = "renewal";
    }
  }

  if (changed) {
    relationship.updatedAt = nowIso;
  }

  return {
    changed,
    from,
    to: changed ? to : null,
    renewalDate: relationship.renewalDate,
  };
}

export type TickRenewalResult = {
  relationshipId: string;
  venueName: string;
  from: CustomerSuccessStage | null;
  to: CustomerSuccessStage | null;
  skipped?: string;
  renewalDate?: string | null;
};

function toTickResult(
  row: Relationship,
  applied: ApplyRenewalStageResult,
): TickRenewalResult {
  return {
    relationshipId: row.id,
    venueName: row.venue.name,
    from: applied.from,
    to: applied.changed ? applied.to : null,
    skipped: applied.skipped,
    renewalDate: applied.renewalDate ?? row.renewalDate,
  };
}

/**
 * Tick all subscribed relationships for anniversary CS stage moves.
 * Call from cron, `POST …/lifecycle` `{ "action": "tick_renewals" }`,
 * or lightly on CS / relationship page load for local demo feedback.
 */
export async function tickRenewalStages(
  now: Date = new Date(),
): Promise<TickRenewalResult[]> {
  const nowIso = now.toISOString();
  const { result } = await withLiveStore((store) => {
    const out: TickRenewalResult[] = [];
    for (const row of store.relationships) {
      if (!row.subscribedAt) continue;
      const applied = applyRenewalStageEvaluation(row, now);
      appendAutoStageTimeline(store, row, applied, nowIso);
      if (
        applied.changed ||
        applied.skipped === "needs_support_pin" ||
        applied.skipped === "suspended"
      ) {
        out.push(toTickResult(row, applied));
      }
    }
    return out;
  });
  return result ?? [];
}

/** Evaluate a single relationship (page-load helper). */
export async function tickRenewalStageForRelationship(
  relationshipId: string,
  now: Date = new Date(),
): Promise<TickRenewalResult | null> {
  const nowIso = now.toISOString();
  const { result } = await withLiveStore((store) => {
    const row = store.relationships.find((r) => r.id === relationshipId);
    if (!row?.subscribedAt) return null;
    const applied = applyRenewalStageEvaluation(row, now);
    appendAutoStageTimeline(store, row, applied, nowIso);
    return toTickResult(row, applied);
  });
  return result;
}
