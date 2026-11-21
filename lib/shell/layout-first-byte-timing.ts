/**
 * NAV-PERF Wave 6 — layout first-byte timing (measurement only).
 *
 * Emits CloudWatch-friendly JSON with a correlation id. No tokens, emails,
 * raw venue UUIDs, or session payloads. All spans recorded here occur on the
 * shared layout path that blocks first response byte.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";

type LayoutTimingCtx = {
  correlationId: string;
  deploymentId: string | null;
  t0: number;
  durationsMs: Record<string, number>;
  extras: Record<string, string | number | boolean | null>;
  venueHash: string | null;
  emitted: boolean;
};

const storage = new AsyncLocalStorage<LayoutTimingCtx>();

function nowMs(): number {
  return performance.now();
}

export function hashVenueIdForLayoutTiming(venueId: string): string {
  return createHash("sha256").update(`htc-layout-fb:${venueId}`).digest("hex").slice(0, 12);
}

export function isLayoutFirstByteTimingActive(): boolean {
  return Boolean(storage.getStore());
}

export function withLayoutFirstByteTiming<T>(fn: () => Promise<T>): Promise<T> {
  const ctx: LayoutTimingCtx = {
    correlationId: randomUUID(),
    deploymentId: process.env.NEXT_DEPLOYMENT_ID ?? null,
    t0: nowMs(),
    durationsMs: {},
    extras: {},
    venueHash: null,
    emitted: false,
  };
  return storage.run(ctx, async () => {
    layoutFbBoundary("layout_start", 0);
    try {
      return await fn();
    } finally {
      emitLayoutFirstByteSummary(ctx);
    }
  });
}

export function layoutFbSetVenue(venueId: string): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.venueHash = hashVenueIdForLayoutTiming(venueId);
}

export function layoutFbExtra(name: string, value: string | number | boolean | null): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.extras[name] = value;
}

export function layoutFbBoundary(boundary: string, durationMs: number): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  const ms = Math.round(durationMs);
  ctx.durationsMs[boundary] = ms;
  console.info(
    JSON.stringify({
      event: "layout_first_byte_boundary",
      correlation_id: ctx.correlationId,
      venue_hash: ctx.venueHash,
      deployment_id: ctx.deploymentId,
      before_first_byte: true,
      boundary,
      duration_ms: ms,
    }),
  );
}

export async function layoutFbTime<T>(boundary: string, fn: () => Promise<T> | T): Promise<T> {
  const ctx = storage.getStore();
  if (!ctx) return await fn();
  const start = nowMs();
  try {
    return await fn();
  } finally {
    layoutFbBoundary(boundary, nowMs() - start);
  }
}

function emitLayoutFirstByteSummary(ctx: LayoutTimingCtx): void {
  if (ctx.emitted) return;
  ctx.emitted = true;
  const totalMs = Math.round(nowMs() - ctx.t0);
  layoutFbBoundary("layout_complete_before_first_byte", totalMs);
  const payload = {
    event: "layout_first_byte_timing",
    correlation_id: ctx.correlationId,
    venue_hash: ctx.venueHash,
    deployment_id: ctx.deploymentId,
    before_first_byte: true,
    total_ms: totalMs,
    durations_ms: ctx.durationsMs,
    extras: ctx.extras,
    emitted_at: new Date().toISOString(),
  };
  console.info(JSON.stringify(payload));
  // Step 1 measurement only — opt-in file sink for local hop splits.
  const sink = process.env.HTC_LAYOUT_FB_FILE?.trim();
  if (sink) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("node:fs") as typeof import("node:fs");
      fs.appendFileSync(sink, `${JSON.stringify(payload)}\n`);
    } catch {
      /* ignore sink failures */
    }
  }
}
