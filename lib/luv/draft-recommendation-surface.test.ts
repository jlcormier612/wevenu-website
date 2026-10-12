import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  followUpDraftBlockReason,
  neutralizeFollowUpUrgingCopy,
  observationUrgesFollowUp,
  observationsForDraftSurface,
} from "@/lib/luv/draft-recommendation-surface";
import { LUV_FOLLOW_UP_SILENCE } from "@/lib/luv/luv-panel-copy";
import type { LuvObservation } from "@/lib/luv/types";

const hot: LuvObservation = {
  id: "momentum-hot-L1",
  kind: "inference",
  priority: "medium",
  message: "Casey is showing strong interest right now.",
  detail: "Good timing — may be worth following up while the interest is fresh.",
  link: "/leads/L1",
  recommendation: {
    label: "Ask Luv to draft a follow-up",
    link: "/leads/L1?luv=follow_up_email",
    type: "draft",
  },
};

describe("observationsForDraftSurface", () => {
  it("keeps draft recommendations when drafting is eligible", () => {
    const out = observationsForDraftSurface([hot], true);
    assert.equal(out[0]?.recommendation?.type, "draft");
    assert.match(out[0]?.detail ?? "", /follow/);
  });

  it("keeps draft recommendation when ineligible so Noticed can show the silence reason", () => {
    const out = observationsForDraftSurface([hot], false, { silence: true });
    assert.equal(out[0]?.recommendation?.type, "draft");
    assert.match(out[0]?.message ?? "", /strong interest/);
  });

  it("removes follow-up urging detail under silence so Noticed does not contradict the Luv tab", () => {
    const out = observationsForDraftSurface([hot], false, { silence: true });
    assert.equal(out[0]?.detail, undefined);
    assert.doesNotMatch(out[0]?.message ?? "", /follow/i);
    assert.ok(!observationUrgesFollowUp({
      message: out[0]!.message,
      detail: out[0]?.detail,
      recommendation: undefined,
    }));
  });
});

describe("neutralizeFollowUpUrgingCopy", () => {
  it("drops urging detail and keeps factual interest", () => {
    const out = neutralizeFollowUpUrgingCopy(hot);
    assert.match(out.message, /strong interest/);
    assert.equal(out.detail, undefined);
  });
});

describe("followUpDraftBlockReason", () => {
  it("uses silence copy for completed-tour / no_outreach — not outreach or stage fiction", () => {
    const reason = followUpDraftBlockReason({
      eligible: false,
      tour: { kind: "completed", scheduledAt: "2026-08-30T14:45:00Z", completedAt: "2026-09-15T17:32:00Z" },
      workflowIntent: "no_outreach",
    });
    assert.equal(reason, LUV_FOLLOW_UP_SILENCE);
    assert.doesNotMatch(reason ?? "", /outreach|stage/i);
  });

  it("returns null when eligible", () => {
    assert.equal(
      followUpDraftBlockReason({
        eligible: true,
        tour: { kind: "none" },
        workflowIntent: "invite_to_schedule_tour",
      }),
      null,
    );
  });
});
