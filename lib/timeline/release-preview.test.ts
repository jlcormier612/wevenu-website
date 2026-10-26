/**
 * Timeline P1b — G1-A release preview classification + entry-point/source guards.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  classifyVenueTimelineReleasePreview,
  fixedDateOutsidePlanningPad,
  holdOutIdsMatch,
  isUnresolvedTimingAttention,
  UNRESOLVED_ATTENTIONS,
  workingTimelineFingerprint,
  type ReleasePreviewItem,
} from "@/lib/timeline/release-preview";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function item(
  partial: Partial<ReleasePreviewItem> & Pick<ReleasePreviewItem, "id" | "title">,
): ReleasePreviewItem {
  return {
    dayOffset: 0,
    entryTime: "10:00",
    timingAttention: null,
    timingDayIntent: "relative",
    timingFixedDate: null,
    updatedAt: "2026-10-01T00:00:00Z",
    ...partial,
  };
}

describe("P1b unresolved classification maps exactly to P1a attentions", () => {
  it("only unknown_intent / missing_event_end / invalid_event_end are unresolved", () => {
    assert.deepEqual(
      [...UNRESOLVED_ATTENTIONS].sort(),
      ["invalid_event_end", "missing_event_end", "unknown_intent"],
    );
    assert.equal(isUnresolvedTimingAttention("unknown_intent"), true);
    assert.equal(isUnresolvedTimingAttention("missing_event_end"), true);
    assert.equal(isUnresolvedTimingAttention("invalid_event_end"), true);
    assert.equal(isUnresolvedTimingAttention(null), false);
    assert.equal(isUnresolvedTimingAttention(undefined), false);
    assert.equal(isUnresolvedTimingAttention("something_else"), false);
  });

  it("does not invent title-based importance", () => {
    const src = read("lib/timeline/release-preview.ts");
    assert.doesNotMatch(src, /title\.(includes|match|toLowerCase)|important|ceremony|critical/i);
    const classified = classifyVenueTimelineReleasePreview(
      [
        item({ id: "a", title: "CRITICAL Ceremony", timingAttention: "unknown_intent" }),
        item({ id: "b", title: "optional snack", timingAttention: null }),
      ],
      new Set(),
      "2026-10-10",
    );
    assert.equal(classified.heldOut.length, 1);
    assert.equal(classified.heldOut[0].id, "a");
    assert.equal(classified.willShare.length, 1);
    assert.equal(classified.willShare[0].id, "b");
    assert.equal(classified.blocksRelease.length, 0);
  });
});

describe("G1-A classifyVenueTimelineReleasePreview", () => {
  it("first release: resolved → will_share; never-released unresolved → held_out", () => {
    const result = classifyVenueTimelineReleasePreview(
      [
        item({ id: "1", title: "Doors", timingAttention: null }),
        item({ id: "2", title: "TBD", timingAttention: "unknown_intent" }),
      ],
      new Set(),
      "2026-10-10",
    );
    assert.equal(result.willShare.map((x) => x.id).join(","), "1");
    assert.equal(result.heldOut.map((x) => x.id).join(","), "2");
    assert.equal(result.blocksRelease.length, 0);
    assert.equal(result.canRelease, true);
  });

  it("previously released unresolved blocks the next release", () => {
    const result = classifyVenueTimelineReleasePreview(
      [
        item({ id: "1", title: "Doors", timingAttention: null }),
        item({ id: "2", title: "Was shared", timingAttention: "missing_event_end" }),
      ],
      new Set(["2"]),
      "2026-10-10",
    );
    assert.equal(result.blocksRelease.map((x) => x.id).join(","), "2");
    assert.equal(result.blocksRelease[0].reason, "previously_released_unresolved");
    assert.equal(result.heldOut.length, 0);
    assert.equal(result.canRelease, false);
  });

  it("never silently omits a previously released unresolved item as held_out", () => {
    const result = classifyVenueTimelineReleasePreview(
      [item({ id: "x", title: "Prior", timingAttention: "invalid_event_end" })],
      new Set(["x"]),
      "2026-10-10",
    );
    assert.equal(result.blocksRelease.length, 1);
    assert.equal(result.heldOut.length, 0);
    assert.equal(result.willShare.length, 0);
  });

  it("±14-day fixed date is informational soft warning, not a blocker", () => {
    assert.equal(fixedDateOutsidePlanningPad("2026-10-10", "2026-09-01"), true);
    assert.equal(fixedDateOutsidePlanningPad("2026-10-10", "2026-10-12"), false);
    const result = classifyVenueTimelineReleasePreview(
      [
        item({
          id: "far",
          title: "Far fixed",
          timingAttention: null,
          timingDayIntent: "fixed",
          timingFixedDate: "2026-01-01",
        }),
      ],
      new Set(),
      "2026-10-10",
    );
    assert.equal(result.canRelease, true);
    assert.equal(result.blocksRelease.length, 0);
    assert.equal(result.softWarnings.length, 1);
    assert.equal(result.softWarnings[0].reason, "fixed_outside_planning_pad");
  });

  it("missing/invalid end attentions stay unresolved and are never auto-resolved", () => {
    for (const attention of ["missing_event_end", "invalid_event_end"] as const) {
      const result = classifyVenueTimelineReleasePreview(
        [item({ id: "e", title: "End anchored", timingAttention: attention })],
        new Set(),
        "2026-10-10",
      );
      assert.equal(result.heldOut.length, 1);
      assert.equal(result.willShare.length, 0);
    }
  });

  it("holdOutIdsMatch requires exact set equality", () => {
    assert.equal(holdOutIdsMatch(["a", "b"], ["b", "a"]), true);
    assert.equal(holdOutIdsMatch(["a"], ["a", "b"]), false);
    assert.equal(holdOutIdsMatch(["a", "b"], ["a"]), false);
    assert.equal(holdOutIdsMatch([], []), true);
  });

  it("workingTimelineFingerprint is stable and order-independent", () => {
    const a = [
      item({ id: "2", title: "B", updatedAt: "t2" }),
      item({ id: "1", title: "A", updatedAt: "t1" }),
    ];
    const b = [
      item({ id: "1", title: "A", updatedAt: "t1" }),
      item({ id: "2", title: "B", updatedAt: "t2" }),
    ];
    assert.equal(workingTimelineFingerprint(a), workingTimelineFingerprint(b));
    const changed = [item({ id: "1", title: "A!", updatedAt: "t1" }), item({ id: "2", title: "B", updatedAt: "t2" })];
    assert.notEqual(workingTimelineFingerprint(a), workingTimelineFingerprint(changed));
  });
});

describe("P1b persistence + portal source contract", () => {
  const mig = read("supabase/migrations/20261423800000_venue_timeline_releases.sql");

  it("migration creates append-only releases, active pointer, preview/confirm RPCs, cutover", () => {
    assert.match(mig, /create table if not exists public\.venue_timeline_releases/);
    assert.match(mig, /active_venue_timeline_release_id/);
    assert.match(mig, /preview_venue_timeline_release/);
    assert.match(mig, /confirm_venue_timeline_release/);
    assert.match(mig, /for update/i);
    assert.match(mig, /stale_preview/);
    assert.match(mig, /idempotentReplay/);
    assert.match(mig, /source = 'cutover'/);
    assert.match(mig, /on conflict \(event_id, idempotency_key\) do nothing/);
    assert.match(mig, /security definer/i);
    assert.match(mig, /set search_path = public/);
    assert.match(mig, /current_user_venue_id/);
  });

  it("portal venue items come from active release snapshot, not live client audience tags", () => {
    assert.match(mig, /create or replace function public\.get_portal_run_of_show/);
    assert.match(mig, /active_venue_timeline_release_id/);
    assert.match(mig, /from public\.venue_timeline_releases r/);
    // Couple-owned live rows remain separate.
    assert.match(mig, /te\.owner = 'client'/);
    assert.doesNotMatch(
      mig.slice(mig.indexOf("get_portal_run_of_show")),
      /owner = 'venue' and 'client' = any\(te\.audiences\)/,
    );
  });

  it("snapshot embeds links and attachments (immutable released content)", () => {
    assert.match(mig, /_venue_timeline_entry_release_json/);
    assert.match(mig, /timeline_entry_links/);
    assert.match(mig, /timeline_entry_attachments/);
  });

  it("cutover only includes previously client-tagged venue rows and is retry-safe", () => {
    assert.match(mig, /'client' = any\(te\.audiences\)/);
    assert.match(mig, /idempotency_key = 'cutover:'/);
    assert.match(mig, /active_venue_timeline_release_id is null/);
  });

  it("G1-A SQL unresolved set matches TS classifier; no G1-B timed-day gate", () => {
    assert.match(mig, /unknown_intent', 'missing_event_end', 'invalid_event_end/);
    assert.doesNotMatch(mig, /timed.?day|completeness.?gate|G1-B/i);
    assert.match(mig, /_timeline_fixed_outside_pad/);
  });
});

describe("P1b app entry points use the release model", () => {
  it("service share + prepare-release call releaseVenueTimelineForPrepare", () => {
    assert.match(read("lib/timeline/service.ts"), /releaseVenueTimelineForPrepare/);
    assert.match(read("lib/event-setup/prepare-release.ts"), /releaseVenueTimelineForPrepare/);
  });

  it("actions expose preview and confirm; couple submissions unchanged", () => {
    const actions = read("app/(app)/events/[id]/timeline-actions.ts");
    assert.match(actions, /previewVenueTimelineReleaseAction/);
    assert.match(actions, /confirmVenueTimelineReleaseAction/);
    const mig = read("supabase/migrations/20261423800000_venue_timeline_releases.sql");
    assert.match(mig, /timeline_submissions/);
    assert.doesNotMatch(mig, /alter table public\.timeline_submissions/);
  });
});
