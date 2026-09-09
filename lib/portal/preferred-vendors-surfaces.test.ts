import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import { shouldOfferPreferredVendorsNavigation } from "@/lib/portal/preferred-vendors-surfaces";
import {
  NEXT_MILESTONE_BY_BRACKET,
  resolveLuvHomeSuggestion,
  type LuvHomeSuggestionInput,
} from "@/lib/portal/luv-suggestions";

const ROOT = join(process.cwd());

function base(over: Partial<LuvHomeSuggestionInput> = {}): LuvHomeSuggestionInput {
  return {
    daysUntil: 300,
    guestTotal: 10,
    guestAttending: 0,
    readiness: 40,
    bracket: "9-12",
    totalThisWeek: 0,
    questionnaireOpen: false,
    soonKeyDate: null,
    venueAttentionCount: 0,
    dayOfMonth: 2,
    ...over,
  };
}

describe("Preferred Vendors capability gating", () => {
  it("capability ON → Preferred Vendors navigation may appear", () => {
    assert.equal(shouldOfferPreferredVendorsNavigation({ vendors: true }), true);
    assert.equal(shouldOfferPreferredVendorsNavigation(undefined), true);
    assert.equal(shouldOfferPreferredVendorsNavigation(null), true);
  });

  it("capability OFF → Preferred Vendors navigation must not appear", () => {
    assert.equal(shouldOfferPreferredVendorsNavigation({ vendors: false }), false);
  });

  it("Venue Guide and Home deep-links gate via shouldOfferPreferredVendorsNavigation", () => {
    const guide = readFileSync(
      join(ROOT, "components/portal/venue-guide-section.tsx"),
      "utf8",
    );
    const shell = readFileSync(
      join(ROOT, "components/portal/portal-shell.tsx"),
      "utf8",
    );
    const caps = readFileSync(
      join(ROOT, "lib/playbooks/capabilities.ts"),
      "utf8",
    );

    assert.match(guide, /shouldOfferPreferredVendorsNavigation\(/);
    assert.match(guide, /Preferred Vendors/);
    assert.match(shell, /shouldOfferPreferredVendorsNavigation\(planningCapabilities\)/);
    assert.match(shell, /Preferred vendors/);
    assert.match(caps, /case "vendors":\s*return caps\.vendors/);
  });

  it("Luv milestone CTA to vendors is suppressed when vendors capability is off", () => {
    assert.equal(NEXT_MILESTONE_BY_BRACKET["9-12"].destination, "vendors");

    const on = resolveLuvHomeSuggestion(base());
    assert.equal(on.kind, "milestone");
    assert.equal(on.destination, "vendors");

    const off = resolveLuvHomeSuggestion(
      base({ disabledDestinations: ["vendors"] }),
    );
    assert.notEqual(off.destination, "vendors");
    assert.equal(off.kind, "social_proof");
  });
});
