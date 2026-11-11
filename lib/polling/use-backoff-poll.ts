"use client";

import * as React from "react";

import { DEFAULT_POLL_MS, nextPollDelayMs } from "./poll-schedule";

/**
 * Runs `poll` on a self-adjusting schedule: steady cadence while it succeeds,
 * exponential backoff with jitter while it fails, paused entirely while the
 * tab is hidden, and never overlapping itself. `poll` resolves true on
 * success and false on failure — throwing counts as a failure.
 *
 * Replaces bare `setInterval(fetch, 60_000)` pollers, which kept offering the
 * same load to a failing dependency indefinitely.
 */
export function useBackoffPoll(
  poll: () => Promise<boolean>,
  {
    baseMs = DEFAULT_POLL_MS,
    enabled = true,
    restartKey,
  }: { baseMs?: number; enabled?: boolean; restartKey?: unknown } = {},
) {
  // Keep the latest closure without restarting the schedule every render.
  const pollRef = React.useRef(poll);
  React.useEffect(() => {
    pollRef.current = poll;
  });

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let inFlight = false;
    let lastRunAt = 0;

    function clear() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    }

    function schedule(delay: number) {
      clear();
      if (cancelled) return;
      timer = setTimeout(() => void run(), delay);
    }

    async function run() {
      if (cancelled || inFlight) return;
      // A hidden tab has nothing to render; the visibility listener resumes it.
      if (typeof document !== "undefined" && document.hidden) return;

      inFlight = true;
      lastRunAt = Date.now();
      let ok = false;
      try {
        ok = await pollRef.current();
      } catch {
        ok = false;
      } finally {
        inFlight = false;
      }
      if (cancelled) return;

      failures = ok ? 0 : failures + 1;
      schedule(nextPollDelayMs({ baseMs, consecutiveFailures: failures }));
    }

    function onVisibilityChange() {
      if (cancelled || document.hidden) return;
      // Honour the schedule across a tab switch rather than refetching on
      // every focus, which would turn tab-flipping into its own request storm.
      const due = nextPollDelayMs({ baseMs, consecutiveFailures: failures });
      const remaining = due - (Date.now() - lastRunAt);
      if (remaining <= 0) void run();
      else schedule(remaining);
    }

    void run();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      clear();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [baseMs, enabled, restartKey]);
}
