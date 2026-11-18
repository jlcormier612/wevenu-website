/**
 * Draft CTA redundancy UX — explain unavailable generation without GET AI.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { resolveFollowUpDraftRedundancy } from "@/lib/luv/draft-redundancy";
import { pendingReviewDrafts } from "@/lib/luv/draft-status";

describe("Draft redundancy CTA explanation", () => {
  it("pending actionable draft yields review-existing reason (server + UI shared)", () => {
    const decision = resolveFollowUpDraftRedundancy({
      actionablePendingFollowUpCount: 1,
    });
    assert.equal(decision.block, true);
    assert.equal(decision.code, "pending_equivalent");
    assert.match(decision.reason ?? "", /waiting for review/i);
  });

  it("recent outbound yields clear recent-contact reason", () => {
    const now = Date.parse("2026-11-18T12:00:00.000Z");
    const decision = resolveFollowUpDraftRedundancy({
      actionablePendingFollowUpCount: 0,
      recentVenueOutboundAt: "2026-11-17T12:00:00.000Z",
      nowMs: now,
    });
    assert.equal(decision.block, true);
    assert.equal(decision.code, "recent_outbound");
    assert.match(decision.reason ?? "", /reached out recently/i);
  });

  it("panel uses already-loaded pending drafts and hides generate CTA when redundant", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "components/luv/luv-draft-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /resolveFollowUpDraftRedundancy/);
    assert.match(panel, /luv-draft-redundancy-blocked/);
    assert.match(panel, /Review your pending follow-up draft/);
    assert.match(panel, /Manual Messages stay available/);
    assert.doesNotMatch(panel, /Draft another/);
    // No OpenAI / portal-context load on panel module
    assert.doesNotMatch(panel, /openAiChatCompletion|loadLuvAskPortalContext|getLuvObservations/);
  });

  it("lifecycle-withdrawn drafts do not count as actionable pending for CTA", () => {
    const rows = [
      {
        id: "a",
        status: "pending_review" as const,
        lifecycleWithdrawal: {
          withdrawnAt: "2026-11-01T00:00:00.000Z",
          reasonCode: "booked",
          reason: "booked",
        },
      },
      { id: "b", status: "pending_review" as const },
    ];
    assert.deepEqual(pendingReviewDrafts(rows).map((d) => d.id), ["b"]);
    const decision = resolveFollowUpDraftRedundancy({
      actionablePendingFollowUpCount: pendingReviewDrafts(rows).length,
    });
    assert.equal(decision.block, true);
  });
});
