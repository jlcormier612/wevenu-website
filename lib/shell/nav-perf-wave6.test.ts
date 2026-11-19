/**
 * NAV-PERF Wave 6 — layout first-byte instrumentation + bootstrap parallelization contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { classifyActiveVenueCase } from "@/lib/venue/active-context-logic";

const bootstrap = readFileSync(resolve("lib/venue/active-context.ts"), "utf8");
const layout = readFileSync(resolve("app/(app)/layout.tsx"), "utf8");
const timing = readFileSync(resolve("lib/shell/layout-first-byte-timing.ts"), "utf8");

describe("NAV-PERF Wave 6 — dependency order preserved", () => {
  it("keeps handoff → clear_stale → membership/venue reads → classify", () => {
    const handoff = bootstrap.indexOf("consumeOnboardingHandoff");
    const clear = bootstrap.indexOf("clear_stale_active_venue_context");
    const parallel = bootstrap.indexOf("bootstrap_memberships_and_venue_id_parallel");
    const serialList = bootstrap.indexOf("bootstrap_list_memberships");
    const classify = bootstrap.indexOf("classifyActiveVenueCase({");
    assert.ok(handoff > 0);
    assert.ok(clear > handoff);
    assert.ok(parallel > clear);
    assert.ok(serialList > clear);
    assert.ok(classify > parallel);
    assert.ok(classify > serialList);
  });

  it("does not parallelize clear_stale with membership or venue-id reads", () => {
    // clear_stale must not appear inside the Promise.all that loads memberships+venue id.
    const parallelBlockStart = bootstrap.indexOf("bootstrap_memberships_and_venue_id_parallel");
    const parallelSlice = bootstrap.slice(parallelBlockStart, parallelBlockStart + 500);
    assert.doesNotMatch(parallelSlice, /clear_stale_active_venue_context/);
    assert.doesNotMatch(parallelSlice, /consumeOnboardingHandoff/);
  });
});

describe("NAV-PERF Wave 6 — instrumentation", () => {
  it("layout wraps the document path in withLayoutFirstByteTiming", () => {
    assert.match(layout, /withLayoutFirstByteTiming/);
    assert.match(layout, /layout_get_user/);
    assert.match(layout, /layout_bootstrap/);
    assert.match(layout, /layout_get_current_venue/);
    assert.match(layout, /layout_gates_parallel/);
  });

  it("timing events mark before_first_byte and avoid raw secrets fields", () => {
    assert.match(timing, /before_first_byte:\s*true/);
    assert.match(timing, /layout_first_byte_timing/);
    assert.match(timing, /correlation_id/);
    assert.doesNotMatch(timing, /access_token|refresh_token|password|Authorization/i);
  });

  it("does not include Wave 5 companion scheduling", () => {
    assert.doesNotMatch(layout, /companion-scheduling|whenShellAllowsAutomaticCompanions/);
    assert.doesNotMatch(bootstrap, /companion-scheduling/);
  });
});

describe("NAV-PERF Wave 6 — classification semantics unchanged", () => {
  it("preserves B_keep_valid / D_none / C needs selection / E stale", () => {
    assert.equal(
      classifyActiveVenueCase({
        memberships: [{ venueId: "a" }, { venueId: "b" }],
        dbContextVenueId: "a",
        dbContextMembershipValid: true,
      }),
      "B_keep_valid",
    );
    assert.equal(
      classifyActiveVenueCase({
        memberships: [],
        dbContextVenueId: null,
        dbContextMembershipValid: false,
      }),
      "D_none",
    );
    assert.equal(
      classifyActiveVenueCase({
        memberships: [{ venueId: "a" }, { venueId: "b" }],
        dbContextVenueId: null,
        dbContextMembershipValid: false,
      }),
      "C_need_selection",
    );
    assert.equal(
      classifyActiveVenueCase({
        memberships: [{ venueId: "a" }, { venueId: "b" }],
        dbContextVenueId: "gone",
        dbContextMembershipValid: false,
      }),
      "E_stale_need_selection",
    );
  });
});

