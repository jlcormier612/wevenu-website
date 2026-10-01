import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  forensicCount,
  forensicRecordL1,
  forensicSetVenue,
  forensicTime,
  hashVenueId,
  sanitizeObservationFamily,
  withDashboardForensic,
} from "@/lib/dashboard/forensic-timing";

describe("dashboard forensic timing helper", () => {
  it("hashes venue ids to short non-PII tokens", () => {
    const a = hashVenueId("a415ac52-0000-0000-0000-000000000001");
    const b = hashVenueId("a415ac52-0000-0000-0000-000000000002");
    assert.equal(a.length, 12);
    assert.notEqual(a, b);
    assert.doesNotMatch(a, /a415ac52/);
  });

  it("sanitizes observation families without UUIDs", () => {
    assert.equal(
      sanitizeObservationFamily("setup-gap-a415ac52-0000-4000-8000-000000000001"),
      "setup-gap",
    );
    assert.equal(sanitizeObservationFamily("insight_momentum"), "insight_momentum");
    assert.equal(sanitizeObservationFamily("comm-all-delivered"), "comm-all-delivered");
  });

  it("records nested boundary durations and L1 under one request id", async () => {
    const logs: string[] = [];
    const original = console.info;
    console.info = (...args: unknown[]) => {
      logs.push(String(args[0]));
    };
    try {
      await withDashboardForensic(async () => {
        forensicSetVenue("venue-forensic-test");
        await forensicTime("wave_a", async () => {
          await new Promise((r) => setTimeout(r, 5));
        });
        forensicCount("rows", 3);
        forensicRecordL1({
          source: "focus_aggregate",
          type: "/tasks",
          candidate: "/tasks",
          path: "test.path",
        });
      });
    } finally {
      console.info = original;
    }

    const summary = logs
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .find((row) => row?.event === "dashboard_forensic_timing");

    assert.ok(summary);
    assert.equal(typeof summary.request_id, "string");
    assert.equal(typeof summary.venue_hash, "string");
    assert.equal((summary.venue_hash as string).length, 12);
    const durations = summary.durations_ms as Record<string, number>;
    assert.ok(durations.wave_a >= 5);
    assert.ok((summary.total_ms as number) >= durations.wave_a);
    assert.equal((summary.counts as Record<string, number>).rows, 3);
    const l1 = summary.l1 as { source: string; type: string; path: string };
    assert.equal(l1.source, "focus_aggregate");
    assert.equal(l1.type, "/tasks");
    assert.equal(l1.path, "test.path");
  });
});

describe("Phase 3B forensic instrumentation wiring", () => {
  const root = process.cwd();
  const read = (rel: string) => readFileSync(join(root, rel), "utf8");

  it("wires ALS forensic wrapper on the Dashboard page", () => {
    const page = read("app/(app)/dashboard/page.tsx");
    assert.match(page, /withDashboardForensic/);
    assert.match(page, /forensicTime\("get_dashboard_data"/);
    assert.match(page, /forensicTime\("business_snapshot"/);
    assert.match(page, /forensicTime\("rsc_focus_l1_assembly"/);
  });

  it("times Dashboard service wave boundaries and L1 inputs", () => {
    const service = read("lib/dashboard/service.ts");
    assert.match(service, /forensicTime\("auth_venue_resolution"/);
    assert.match(service, /forensicTime\("focus_population"/);
    assert.match(service, /forensicTime\("get_focus_briefing"/);
    assert.match(service, /forensicTime\("get_luv_observations"/);
    assert.match(service, /forensicTime\("get_communication_observations"/);
    assert.match(service, /forensicTime\("get_venue_insights"/);
    assert.match(service, /forensicTime\("read_venue_recommendations"/);
    assert.match(service, /forensicTime\("dismissed_observation_ids"/);
    assert.match(service, /forensicTime\("activation_score"/);
    assert.match(service, /forensicTime\("load_venue_readiness"/);
    assert.match(service, /forensicTime\("next_pending_milestone"/);
  });

  it("records L1 winning source on the real selection path", () => {
    const entry = read("lib/dashboard-system/luv-entry.ts");
    assert.match(entry, /forensicRecordL1/);
    assert.match(entry, /selectLuvDashboardEntry\.recommendation/);
    assert.match(entry, /selectLuvDashboardEntry\.observation/);
    assert.match(entry, /selectLuvDashboardEntry\.focus_aggregate/);
    assert.match(entry, /selectLuvDashboardEntry\.none/);
  });

  it("splits insights compute vs get RPCs", () => {
    const insights = read("lib/luv/insights-service.ts");
    assert.match(insights, /insights_compute_rpc/);
    assert.match(insights, /insights_get_rpc/);
  });
});
