/**
 * NAV-PERF Wave 7A — booking workspace first-byte timing (measurement only).
 *
 * Emits CloudWatch-friendly JSON with a correlation id. No tokens, emails,
 * raw venue/client/event UUIDs, or session payloads.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";

type BookingTimingCtx = {
  correlationId: string;
  deploymentId: string | null;
  t0: number;
  durationsMs: Record<string, number>;
  extras: Record<string, string | number | boolean | null>;
  venueHash: string | null;
  emitted: boolean;
};

const storage = new AsyncLocalStorage<BookingTimingCtx>();

function nowMs(): number {
  return performance.now();
}

export function hashVenueIdForBookingTiming(venueId: string): string {
  return createHash("sha256").update(`htc-booking-fb:${venueId}`).digest("hex").slice(0, 12);
}

export function isBookingFirstByteTimingActive(): boolean {
  return Boolean(storage.getStore());
}

export function withBookingFirstByteTiming<T>(fn: () => Promise<T>): Promise<T> {
  const ctx: BookingTimingCtx = {
    correlationId: randomUUID(),
    deploymentId:
      process.env.NEXT_DEPLOYMENT_ID && process.env.NEXT_DEPLOYMENT_ID !== "false"
        ? process.env.NEXT_DEPLOYMENT_ID
        : null,
    t0: nowMs(),
    durationsMs: {},
    extras: {},
    venueHash: null,
    emitted: false,
  };
  return storage.run(ctx, async () => {
    bookingFbBoundary("booking_page_start", 0);
    try {
      return await fn();
    } finally {
      emitBookingFirstByteSummary(ctx);
    }
  });
}

export function bookingFbSetVenue(venueId: string): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.venueHash = hashVenueIdForBookingTiming(venueId);
}

export function bookingFbExtra(name: string, value: string | number | boolean | null): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.extras[name] = value;
}

export function bookingFbBoundary(boundary: string, durationMs: number): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  const ms = Math.round(durationMs);
  ctx.durationsMs[boundary] = ms;
  console.info(
    JSON.stringify({
      event: "booking_first_byte_boundary",
      correlation_id: ctx.correlationId,
      venue_hash: ctx.venueHash,
      deployment_id: ctx.deploymentId,
      before_first_byte: true,
      boundary,
      duration_ms: ms,
    }),
  );
}

export async function bookingFbTime<T>(boundary: string, fn: () => Promise<T> | T): Promise<T> {
  const ctx = storage.getStore();
  if (!ctx) return await fn();
  const start = nowMs();
  try {
    return await fn();
  } finally {
    bookingFbBoundary(boundary, nowMs() - start);
  }
}

/** Post-first-byte spans (deferred Suspense island). */
export function bookingFbDeferredBoundary(boundary: string, durationMs: number): void {
  const ctx = storage.getStore();
  const ms = Math.round(durationMs);
  console.info(
    JSON.stringify({
      event: "booking_first_byte_boundary",
      correlation_id: ctx?.correlationId ?? null,
      venue_hash: ctx?.venueHash ?? null,
      deployment_id: ctx?.deploymentId ?? process.env.NEXT_DEPLOYMENT_ID ?? null,
      before_first_byte: false,
      boundary,
      duration_ms: ms,
    }),
  );
}

export async function bookingFbDeferredTime<T>(boundary: string, fn: () => Promise<T> | T): Promise<T> {
  const start = nowMs();
  try {
    return await fn();
  } finally {
    bookingFbDeferredBoundary(boundary, nowMs() - start);
  }
}

function emitBookingFirstByteSummary(ctx: BookingTimingCtx): void {
  if (ctx.emitted) return;
  ctx.emitted = true;
  const totalMs = Math.round(nowMs() - ctx.t0);
  bookingFbBoundary("booking_page_return_before_first_byte", totalMs);
  console.info(
    JSON.stringify({
      event: "booking_first_byte_timing",
      correlation_id: ctx.correlationId,
      venue_hash: ctx.venueHash,
      deployment_id: ctx.deploymentId,
      before_first_byte: true,
      total_ms: totalMs,
      durations_ms: ctx.durationsMs,
      extras: ctx.extras,
    }),
  );
}
