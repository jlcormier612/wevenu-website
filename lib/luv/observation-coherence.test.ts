import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cohereLeadObservations,
  dedupeObservations,
  isZeroValueObservation,
  observationsContradictSilence,
} from "@/lib/luv/observation-coherence";
import type { LuvObservation } from "@/lib/luv/types";

const hot: LuvObservation = {
  id: "m1",
  kind: "inference",
  priority: "medium",
  message: "Casey is showing strong interest right now.",
  detail: "Good timing — may be worth following up while the interest is fresh.",
  link: "/leads/L1",
  recommendation: { label: "Ask Luv to draft a follow-up", link: "/leads/L1?luv=follow_up_email", type: "draft" },
};

describe("observation coherence", () => {
  it("dedupes by normalized message", () => {
    const out = dedupeObservations([hot, { ...hot, id: "m2" }]);
    assert.equal(out.length, 1);
  });

  it("flags zero-value tautologies", () => {
    assert.equal(
      isZeroValueObservation({
        id: "z",
        kind: "fact",
        priority: "low",
        message: "Lead exists",
        link: "/leads/L1",
      }),
      true,
    );
  });

  it("under silence, interest+draft cannot remain to contradict empty-state", () => {
    const out = cohereLeadObservations([hot], { proactiveRecommended: false });
    assert.equal(out.length, 0);
    assert.equal(observationsContradictSilence(out), false);
  });

  it("under proactive, keeps draft recommendation", () => {
    const out = cohereLeadObservations([hot], { proactiveRecommended: true });
    assert.equal(out[0]?.recommendation?.type, "draft");
  });
});
