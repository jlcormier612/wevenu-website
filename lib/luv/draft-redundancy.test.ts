import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FOLLOW_UP_REDUNDANT_OUTBOUND_WINDOW_MS,
  latestVenueOutboundAt,
  resolveFollowUpDraftRedundancy,
} from "@/lib/luv/draft-redundancy";

describe("follow-up draft redundancy", () => {
  it("blocks when an actionable pending follow-up already exists", () => {
    const d = resolveFollowUpDraftRedundancy({
      actionablePendingFollowUpCount: 1,
    });
    assert.equal(d.block, true);
    assert.equal(d.code, "pending_equivalent");
    assert.match(d.reason ?? "", /already a follow-up draft/i);
  });

  it("allows generate when no pending and no recent outbound", () => {
    const d = resolveFollowUpDraftRedundancy({
      actionablePendingFollowUpCount: 0,
      recentVenueOutboundAt: null,
    });
    assert.equal(d.block, false);
  });

  it("blocks when venue outbound is within the redundancy window", () => {
    const now = Date.parse("2026-11-18T18:00:00Z");
    const d = resolveFollowUpDraftRedundancy({
      actionablePendingFollowUpCount: 0,
      recentVenueOutboundAt: "2026-11-18T12:00:00Z",
      nowMs: now,
    });
    assert.equal(d.block, true);
    assert.equal(d.code, "recent_outbound");
  });

  it("allows when outbound is older than the window", () => {
    const now = Date.parse("2026-11-18T18:00:00Z");
    const older = new Date(now - FOLLOW_UP_REDUNDANT_OUTBOUND_WINDOW_MS - 1000).toISOString();
    const d = resolveFollowUpDraftRedundancy({
      actionablePendingFollowUpCount: 0,
      recentVenueOutboundAt: older,
      nowMs: now,
    });
    assert.equal(d.block, false);
  });

  it("latestVenueOutboundAt ignores customer senders", () => {
    assert.equal(
      latestVenueOutboundAt([
        { sentAt: "2026-11-18T10:00:00Z", senderType: "customer" },
        { sentAt: "2026-11-18T09:00:00Z", senderType: "venue" },
      ]),
      "2026-11-18T09:00:00Z",
    );
  });
});
