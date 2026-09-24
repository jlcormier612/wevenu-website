import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildDraftOfferView } from "@/components/booking-journey/create-proposal-sheet";
import { depositFromVenuePercent } from "@/lib/booking-journey/venue-prefs";
import { suggestDepositAmount } from "@/lib/commercial-selections/constants";
import type { PackageWithItems } from "@/lib/packages/types";

function pkg(
  id: string,
  name: string,
  price: number,
  offerRole: "primary" | "addon" = "primary",
): PackageWithItems {
  return {
    id,
    venueId: "v",
    name,
    description: `${name} description`,
    basePrice: price,
    category: null,
    isActive: true,
    sortOrder: 0,
    sourceMasterKey: null,
    offerRole,
    eligibleEventTypes: null,
    minGuestCount: null,
    maxGuestCount: null,
    eligibleSpaceIds: null,
    createdAt: "",
    updatedAt: "",
    items: [{ id: "i", packageId: id, venueId: "v", description: "Inclusion A", quantity: 1, unit: null, sortOrder: 0, createdAt: "" }],
  };
}

describe("multi-option proposal preview draft", () => {
  it("builds OfferView options from drafts without inventing a purchase total", () => {
    const packages = [
      pkg("e", "Essential Wedding", 15000),
      pkg("f", "Full Service Wedding", 25000),
      pkg("s", "Signature Wedding", 32000),
      pkg("a", "Photo Booth", 500, "addon"),
    ];
    const view = buildDraftOfferView({
      drafts: [
        { packageId: "e", offerRole: "primary" },
        { packageId: "f", offerRole: "primary" },
        { packageId: "s", offerRole: "primary" },
        { packageId: "a", offerRole: "addon" },
      ],
      packages,
      message: "Looking forward to hosting you.",
      venueName: "Jen's Fancy Venue",
      brand: {
        primaryColor: "#111",
        secondaryColor: "#222",
        accentColor: "#333",
        neutralColor: "#fff",
      },
    });
    assert.equal(view.kind, "proposal");
    assert.equal(view.venueName, "Jen's Fancy Venue");
    assert.equal(view.offerMessage, "Looking forward to hosting you.");
    assert.equal(view.options?.length, 4);
    assert.equal(view.options?.filter((o) => o.offerRole === "primary").length, 3);
    assert.equal(view.options?.filter((o) => o.offerRole === "addon").length, 1);
    assert.equal(view.depositAmount, 0);
    assert.equal(view.totalAmount, 0);
    assert.ok(view.options?.some((o) => o.includedItems.length > 0));
  });
});

describe("multi-option deposit after selection (intended model)", () => {
  it("deposit is % of chosen total — not max of alternatives", () => {
    const prefs = { defaultDepositPercent: 25 };
    assert.equal(depositFromVenuePercent(15000, prefs), 3750);
    assert.equal(depositFromVenuePercent(25000, prefs), 6250);
    assert.equal(depositFromVenuePercent(32000, prefs), 8000);
    assert.equal(suggestDepositAmount(15000, 3750), 3750);
    // Legacy leak: 25% of max($15k,$25k,$32k) = $8k must not be applied to Essential
    const maxPrimaryLeak = suggestDepositAmount(32000, null);
    assert.equal(maxPrimaryLeak, 8000);
    assert.notEqual(maxPrimaryLeak, suggestDepositAmount(15000, null));
  });
});

describe("create proposal sheet flow wiring", () => {
  it("Preview → Send uses shared MultiOptionProposalView; no maxPrimary deposit field", () => {
    const sheet = readFileSync(resolve("components/booking-journey/create-proposal-sheet.tsx"), "utf8");
    const overlay = readFileSync(resolve("components/artifacts/artifact-review-overlay.tsx"), "utf8");
    assert.match(sheet, /ArtifactReviewOverlay/);
    assert.match(sheet, /open=\{open && step === "preview"\}/);
    assert.match(sheet, /open=\{open && step !== "preview"\}/);
    assert.doesNotMatch(sheet, /sm:max-w-xl/);
    assert.match(overlay, /Back to edit/);
    assert.match(overlay, /createPortal/);
    assert.match(overlay, /z-\[200\]/);
    assert.match(overlay, /min-h-0 flex-1 overflow-x-hidden overflow-y-auto/);
    assert.match(sheet, /Send proposal/);
    assert.match(sheet, /MultiOptionProposalView/);
    assert.match(sheet, /mode="preview"/);
    assert.match(sheet, /depositAmount: 0/);
    assert.doesNotMatch(sheet, /Suggested deposit/);
    assert.doesNotMatch(sheet, /maxPrimary/);
    assert.match(sheet, /createProposalAction/);
    assert.match(sheet, /sendProposalAction/);
    const view = readFileSync(resolve("components/booking-journey/multi-option-proposal-view.tsx"), "utf8");
    assert.match(view, /Your proposal/);
    assert.match(view, /Choose what you want/);
    assert.match(view, /Approve my selection/);
    const couple = readFileSync(resolve("components/booking-journey/offer-select-client.tsx"), "utf8");
    assert.match(couple, /MultiOptionProposalView/);
    const service = readFileSync(resolve("lib/commercial-proposals/service.ts"), "utf8");
    assert.match(service, /applyDepositFromChosenSelection/);
    assert.match(service, /depositFromVenuePercent/);
  });
});
