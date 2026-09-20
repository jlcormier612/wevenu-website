import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { proposalViewFromSelection } from "@/lib/booking-journey/proposal-view";
import { remainingAmount } from "@/lib/commercial-selections/constants";
import type { CommercialSelection } from "@/lib/commercial-selections/types";

const selection: Pick<
  CommercialSelection,
  "name" | "totalAmount" | "depositAmount" | "includedItems" | "status" | "offerMessage"
> = {
  name: "Garden Package",
  totalAmount: 3200,
  depositAmount: 800,
  includedItems: [{ description: "Ceremony lawn", quantity: 1, unit: null }],
  status: "draft",
  offerMessage: null,
};

describe("Proposal review artifact", () => {
  it("builds the couple-facing proposal from the frozen selection plus draft message", () => {
    const view = proposalViewFromSelection(selection, "We would be honored.");
    assert.equal(view.name, "Garden Package");
    assert.equal(view.totalAmount, 3200);
    assert.equal(view.depositAmount, 800);
    assert.equal(view.remainingAmount, remainingAmount(3200, 800));
    assert.equal(view.offerMessage, "We would be honored.");
    assert.deepEqual(view.includedItems, selection.includedItems);
  });

  it("does not mark the proposal accepted merely by previewing", () => {
    const view = proposalViewFromSelection(selection, "Hello");
    assert.equal(view.status, "draft");
  });

  it("reuses ProposalArtifact for couple and venue preview; send stays sendOfferAction", () => {
    const artifact = readFileSync(resolve("components/booking-journey/proposal-artifact.tsx"), "utf8");
    const couple = readFileSync(resolve("components/booking-journey/offer-accept-client.tsx"), "utf8");
    const panel = readFileSync(resolve("components/booking-journey/booking-journey-panel.tsx"), "utf8");
    assert.match(couple, /ProposalArtifact/);
    assert.match(couple, /acceptOfferAction/);
    assert.doesNotMatch(artifact, /acceptOfferAction|sendOfferAction|markOfferAccepted/);
    assert.match(panel, /Review proposal/);
    assert.match(panel, /proposalViewFromSelection/);
    assert.match(panel, /ArtifactReviewOverlay/);
    assert.match(panel, /handleSendOffer/);
    assert.match(panel, /sendOfferAction/);
    assert.match(panel, /Mark accepted \(offline\)/);
    assert.match(panel, /Internal exception/);
    const sendIdx = panel.indexOf('"Create share link"');
    const reviewIdx = panel.indexOf("offerReviewOpen");
    assert.ok(reviewIdx > 0 && sendIdx > reviewIdx);
    const overlayChrome = readFileSync(resolve("components/artifacts/artifact-review-overlay.tsx"), "utf8");
    assert.match(overlayChrome, /createPortal/);
    assert.match(overlayChrome, /z-\[200\]/);
    assert.match(overlayChrome, /document\.body/);
  });

  it("offline acceptance is not the customer-facing send control", () => {
    const panel = readFileSync(resolve("components/booking-journey/booking-journey-panel.tsx"), "utf8");
    const overlay = panel.slice(
      panel.indexOf("<ArtifactReviewOverlay"),
      panel.indexOf("</ArtifactReviewOverlay>"),
    );
    assert.match(overlay, /Create share link/);
    assert.doesNotMatch(overlay, /Send proposal/);
    assert.doesNotMatch(overlay, /handleMarkAccepted|Mark accepted/);
    assert.match(panel, /Internal exception — does not send the proposal to the couple/);
  });
});
