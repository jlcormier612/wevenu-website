/**
 * Phase 3B — temporary timer-only forensic instrumentation for Dashboard GET.
 *
 * Measurement only. Does not change query behavior, selection logic, or
 * persistence. Emits structured CloudWatch-friendly JSON with no PII.
 *
 * Remove after Phase 3B evidence review.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";

export type ForensicL1Record = {
  source: "recommendation" | "observation" | "focus_aggregate" | "NONE";
  /** Non-PII type/family (recommendation.type, observation family, or focus href). */
  type: string | null;
  /** Non-PII candidate tag already available on the selection path. */
  candidate: string | null;
  /** Selection path step that produced the winner. */
  path: string;
};

type ForensicCtx = {
  requestId: string;
  venueHash: string | null;
  deploymentId: string | null;
  t0: number;
  durationsMs: Record<string, number>;
  counts: Record<string, number>;
  extras: Record<string, string | number | boolean | null>;
  l1: ForensicL1Record | null;
  emitted: boolean;
};

const storage = new AsyncLocalStorage<ForensicCtx>();

function nowMs(): number {
  return performance.now();
}

/** Short non-PII venue identifier for log correlation. */
export function hashVenueId(venueId: string): string {
  return createHash("sha256").update(`htc-dash-forensic:${venueId}`).digest("hex").slice(0, 12);
}

/**
 * Strip UUID / long hex suffixes from observation ids so logs keep family only.
 * Example: `setup-gap-abc…` → `setup-gap`; `insight_momentum` unchanged.
 */
export function sanitizeObservationFamily(id: string): string {
  return id
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")
    .replace(/-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}

function getCtx(): ForensicCtx | undefined {
  return storage.getStore();
}

export function isDashboardForensicActive(): boolean {
  return Boolean(getCtx());
}

export function withDashboardForensic<T>(fn: () => Promise<T>): Promise<T> {
  const ctx: ForensicCtx = {
    requestId: randomUUID(),
    venueHash: null,
    deploymentId: process.env.NEXT_DEPLOYMENT_ID ?? null,
    t0: nowMs(),
    durationsMs: {},
    counts: {},
    extras: {},
    l1: null,
    emitted: false,
  };
  return storage.run(ctx, async () => {
    forensicBoundary("request_start", 0);
    try {
      return await fn();
    } finally {
      emitForensicSummary(ctx);
    }
  });
}

export function forensicSetVenue(venueId: string): void {
  const ctx = getCtx();
  if (!ctx) return;
  ctx.venueHash = hashVenueId(venueId);
}

export function forensicCount(name: string, value: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  ctx.counts[name] = value;
}

export function forensicExtra(name: string, value: string | number | boolean | null): void {
  const ctx = getCtx();
  if (!ctx) return;
  ctx.extras[name] = value;
}

export function forensicBoundary(boundary: string, durationMs: number): void {
  const ctx = getCtx();
  if (!ctx) return;
  const ms = Math.round(durationMs);
  ctx.durationsMs[boundary] = ms;
  console.info(
    JSON.stringify({
      event: "dashboard_forensic_boundary",
      request_id: ctx.requestId,
      venue_hash: ctx.venueHash,
      deployment_id: ctx.deploymentId,
      boundary,
      duration_ms: ms,
    }),
  );
}

export async function forensicTime<T>(boundary: string, fn: () => Promise<T> | T): Promise<T> {
  const ctx = getCtx();
  if (!ctx) return await fn();
  const start = nowMs();
  try {
    return await fn();
  } finally {
    forensicBoundary(boundary, nowMs() - start);
  }
}

export function forensicRecordL1(record: ForensicL1Record): void {
  const ctx = getCtx();
  if (!ctx) return;
  ctx.l1 = record;
  console.info(
    JSON.stringify({
      event: "dashboard_forensic_l1",
      request_id: ctx.requestId,
      venue_hash: ctx.venueHash,
      deployment_id: ctx.deploymentId,
      l1_source: record.source,
      l1_type: record.type,
      l1_candidate: record.candidate,
      l1_path: record.path,
    }),
  );
}

function emitForensicSummary(ctx: ForensicCtx): void {
  if (ctx.emitted) return;
  ctx.emitted = true;
  const totalMs = Math.round(nowMs() - ctx.t0);
  forensicBoundary("request_complete", totalMs);
  console.info(
    JSON.stringify({
      event: "dashboard_forensic_timing",
      request_id: ctx.requestId,
      venue_hash: ctx.venueHash,
      deployment_id: ctx.deploymentId,
      total_ms: totalMs,
      durations_ms: ctx.durationsMs,
      counts: ctx.counts,
      extras: ctx.extras,
      l1: ctx.l1 ?? {
        source: "UNKNOWN",
        type: null,
        candidate: null,
        path: "no_l1_record",
      },
    }),
  );
}
