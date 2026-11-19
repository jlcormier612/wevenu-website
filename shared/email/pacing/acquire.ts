/**
 * Distributed Resend slot acquisition via Postgres RPC (fail-closed).
 *
 * Injectable store for deterministic tests. Production uses PostgREST /
 * Supabase RPC acquire_resend_send_slot (sliding 1s window).
 */

import type { EmailSendPriority } from "./priority";
import {
  RESEND_PACING_MAX_BULK,
  RESEND_PACING_MAX_TOTAL,
  RESEND_PACING_WINDOW_MS,
  tryAcquireSlidingSlot,
  type SlidingAcquireEvent,
  type SlotAcquireResult,
} from "./window-slot";

export type PacingAcquireOk = {
  ok: true;
  atMs: number;
  total: number;
};

export type PacingAcquireFail = {
  ok: false;
  code: "capacity" | "pacing_unavailable";
  message: string;
  retryAfterSeconds?: number;
  retryUnsafe: boolean;
};

export type PacingAcquireResult = PacingAcquireOk | PacingAcquireFail;

export type ResendSlotStore = {
  acquire(input: {
    priority: EmailSendPriority;
    nowMs: number;
    maxTotal: number;
    maxBulk: number;
    windowMs: number;
  }): Promise<SlotAcquireResult>;
};

/** In-memory store shared across simulated services in unit tests. */
export function createMemoryResendSlotStore(
  initialEvents: SlidingAcquireEvent[] = [],
): ResendSlotStore & { events: SlidingAcquireEvent[] } {
  const events = [...initialEvents];
  return {
    events,
    async acquire(input) {
      return tryAcquireSlidingSlot(events, input.priority, {
        nowMs: input.nowMs,
        maxTotal: input.maxTotal,
        maxBulk: input.maxBulk,
        windowMs: input.windowMs,
      });
    },
  };
}

let injectedStore: ResendSlotStore | null = null;

/** Test-only: replace the slot store (null restores Postgres RPC). */
export function setResendSlotStoreForTests(store: ResendSlotStore | null): void {
  injectedStore = store;
}

async function postgresAcquire(input: {
  priority: EmailSendPriority;
  nowMs: number;
  maxTotal: number;
  maxBulk: number;
  windowMs: number;
}): Promise<SlotAcquireResult> {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("missing_supabase_for_pacing");
  }

  const res = await fetch(`${url}/rest/v1/rpc/acquire_resend_send_slot`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      p_priority: input.priority,
      p_max_total: input.maxTotal,
      p_max_bulk: input.maxBulk,
      p_window_ms: input.windowMs,
      p_now_ms: input.nowMs,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`pacing_rpc_http_${res.status}:${text.slice(0, 120)}`);
  }

  const data = (await res.json()) as {
    granted?: boolean;
    at_ms?: number;
    critical_count?: number;
    bulk_count?: number;
    total?: number;
    retry_after_ms?: number;
    reason?: string;
  };

  const atMs = Number(data.at_ms ?? input.nowMs);
  const criticalCount = Number(data.critical_count ?? 0);
  const bulkCount = Number(data.bulk_count ?? 0);
  const total = Number(data.total ?? criticalCount + bulkCount);

  if (data.granted) {
    return {
      granted: true,
      atMs,
      criticalCount,
      bulkCount,
      total,
    };
  }

  return {
    granted: false,
    atMs,
    criticalCount,
    bulkCount,
    total,
    retryAfterMs: Math.max(1, Number(data.retry_after_ms ?? 1000)),
    reason: data.reason === "bulk_cap" ? "bulk_cap" : "window_full",
  };
}

function store(): ResendSlotStore {
  if (injectedStore) return injectedStore;
  return { acquire: postgresAcquire };
}

export type AcquireResendSlotOptions = {
  priority: EmailSendPriority;
  /**
   * Max wall-clock wait for a slot (interactive critical sends).
   * Bulk should use 0 (immediate capacity failure → defer).
   */
  maxWaitMs?: number;
  nowMs?: number;
  maxTotal?: number;
  maxBulk?: number;
  windowMs?: number;
  /** Injected clock for tests. */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Fail-closed: any store/RPC/network error → pacing_unavailable (do not send).
 */
export async function acquireResendSendSlot(
  opts: AcquireResendSlotOptions,
): Promise<PacingAcquireResult> {
  const maxTotal = opts.maxTotal ?? RESEND_PACING_MAX_TOTAL;
  const maxBulk = opts.maxBulk ?? RESEND_PACING_MAX_BULK;
  const windowMs = opts.windowMs ?? RESEND_PACING_WINDOW_MS;
  const maxWaitMs =
    opts.maxWaitMs ??
    (opts.priority === "critical" ? 900 : 0);
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const started = opts.nowMs ?? Date.now();
  let nowMs = started;

  try {
    for (;;) {
      const result = await store().acquire({
        priority: opts.priority,
        nowMs,
        maxTotal,
        maxBulk,
        windowMs,
      });

      if (result.granted) {
        return { ok: true, atMs: result.atMs, total: result.total };
      }

      const waited = nowMs - started;
      const waitNeeded = result.retryAfterMs;
      if (waited + waitNeeded > maxWaitMs) {
        return {
          ok: false,
          code: "capacity",
          message:
            opts.priority === "bulk"
              ? "Email send deferred — shared delivery capacity is temporarily full."
              : "Email could not be sent right now — shared delivery capacity is temporarily full. Please try again in a moment.",
          retryAfterSeconds: Math.max(1, Math.ceil(waitNeeded / 1000)),
          retryUnsafe: true,
        };
      }

      await sleep(waitNeeded);
      if (opts.nowMs != null) {
        nowMs = nowMs + waitNeeded;
      } else {
        nowMs = Date.now();
      }
    }
  } catch {
    return {
      ok: false,
      code: "pacing_unavailable",
      message: "Email was not sent — delivery pacing is unavailable (fail-closed).",
      retryAfterSeconds: 1,
      retryUnsafe: true,
    };
  }
}
