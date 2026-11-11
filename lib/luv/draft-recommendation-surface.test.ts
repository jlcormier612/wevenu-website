import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  followUpDraftBlockReason,
  neutralizeFollowUpUrgingCopy,
  observationUrgesFollowUp,
  observationsForDraftSurface,
} from "@/lib/luv/draft-recommendation-surface";
import { observationsContradictSilence } from "@/lib/luv/observation-coherence";
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

const question: LuvObservation = {
  id: "unanswered-q-L1",
  kind: "recommendation",
  priority: "high",
  message: "Casey asked whether Saturday setup is included.",
  detail: "Answer their question before they go quiet.",
  link: "/leads/L1",
  recommendation: {
    label: "Ask Luv to draft a reply",
    link: "/leads/L1?luv=follow_up_email",
    type: "draft",
  },
};

describe("observationsForDraftSurface", () => {
  it("keeps draft recommendations when proactive outreach is recommended", () => {
    const out = observationsForDraftSurface([hot], true, { proactiveRecommended: true });
    assert.equal(out[0]?.recommendation?.type, "draft");
    assert.match(out[0]?.detail ?? "", /follow/);
  });

  it("suppresses strong-interest + draft under proactive silence (Oct 12 contradiction)", () => {
    const out = observationsForDraftSurface([hot], false, { proactiveRecommended: false });
    assert.equal(out.length, 0);
    assert.equal(observationsContradictSilence(out), false);
  });

  it("dedupes identical observations in one view", () => {
    const dup = { ...hot, id: "momentum-hot-L1-dup" };
    const out = observationsForDraftSurface([hot, dup, hot], true, { proactiveRecommended: true });
    assert.equal(out.length, 1);
  });

  it("keeps unanswered-question recommendations when proactive is on", () => {
    const out = observationsForDraftSurface([question], true, { proactiveRecommended: true });
    assert.equal(out[0]?.recommendation?.type, "draft");
    assert.match(out[0]?.message ?? "", /Saturday setup/i);
  });

  it("drops zero-value tautologies", () => {
    const empty: LuvObservation = {
      id: "z1",
      kind: "fact",
      priority: "low",
      message: "Lead exists in pipeline",
      link: "/leads/L1",
    };
    const out = observationsForDraftSurface([empty], true, { proactiveRecommended: true });
    assert.equal(out.length, 0);
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
  it("returns null when draftCapable — completed tour is not a capability block", () => {
    const reason = followUpDraftBlockReason({
      draftCapable: true,
      tour: { kind: "completed", scheduledAt: "2026-08-30T14:45:00Z", completedAt: "2026-09-15T17:32:00Z" },
      workflowIntent: "gentle_check_in",
    });
    assert.equal(reason, null);
  });

  it("uses capability block reason when drafting is closed", () => {
    const reason = followUpDraftBlockReason({
      draftCapable: false,
      capabilityBlockReason: "This inquiry is marked lost — drafting a follow-up isn’t available.",
      tour: { kind: "none" },
      workflowIntent: "gentle_check_in",
    });
    assert.match(reason ?? "", /lost/i);
  });

  it("returns null when eligible (legacy alias)", () => {
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

describe("observationUrgesFollowUp", () => {
  it("detects draft recommendations and urging copy", () => {
    assert.equal(observationUrgesFollowUp(hot), true);
    assert.equal(observationUrgesFollowUp({ message: "Stage is touring", detail: null, recommendation: undefined }), false);
  });
});
