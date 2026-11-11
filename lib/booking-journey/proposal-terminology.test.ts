import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Customer-facing Proposal vs direct-selection terminology", () => {
  it("multi-option L1 keeps Proposal language; Path B uses Review and accept", () => {
    const couple = readFileSync(resolve("components/booking-journey/offer-accept-client.tsx"), "utf8");
    assert.match(couple, /Review and accept/);
    assert.match(couple, /"Accept"/);
    assert.doesNotMatch(couple, /Accept proposal/);

    const artifact = readFileSync(resolve("components/booking-journey/proposal-artifact.tsx"), "utf8");
    assert.match(artifact, /Your proposal/);
    assert.match(artifact, /eyebrow/);

    const panel = readFileSync(resolve("components/booking-journey/booking-journey-panel.tsx"), "utf8");
    assert.match(panel, /Create share link/);
    assert.match(panel, /Review/);
    assert.doesNotMatch(panel, /Send proposal/);

    const model = readFileSync(resolve("lib/booking-journey/model.ts"), "utf8");
    assert.match(model, /Create share link/);
    assert.match(model, /create_proposal/);
    assert.match(model, /select_package/);

    const labels = readFileSync(resolve("lib/commercial-selections/constants.ts"), "utf8");
    assert.match(labels, /Share link created/);
    assert.doesNotMatch(labels, /Proposal sent/);
    assert.match(labels, /accepted: "Accepted"/);

    const settings = readFileSync(
      resolve("components/settings/commercial-booking-prefs-section.tsx"),
      "utf8",
    );
    assert.match(settings, /Let the couple choose/);
    assert.match(settings, /Collect an initial payment/);
    assert.doesNotMatch(settings, /Require initial payment to book/);
    assert.doesNotMatch(settings, /Process order/);
  });

  it("keeps internal offer identifiers", () => {
    const model = readFileSync(resolve("lib/booking-journey/model.ts"), "utf8");
    assert.match(model, /send_offer/);
    const offer = readFileSync(resolve("lib/booking-journey/offer.ts"), "utf8");
    assert.match(offer, /getOfferByToken/);
    assert.match(offer, /\/offer\//);
    const panel = readFileSync(resolve("components/booking-journey/booking-journey-panel.tsx"), "utf8");
    assert.match(panel, /sendOfferAction/);
  });
});

describe("Lead record actions wire to canonical experiences", () => {
  it("lead tabs render Conversation, Notes, Tasks, Activity, Documents, and Luv", () => {
    const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    assert.match(detail, /TabsTrigger value="messages">Conversation/);
    assert.match(detail, /RelationshipConversationTab/);
    assert.match(detail, /NotesSection/);
    assert.match(detail, /TasksSection/);
    assert.match(detail, /ActivityTimelineView/);
    assert.match(detail, /DocumentWorkspace/);
    assert.match(detail, /LuvDraftPanel/);
    assert.match(detail, /BookingJourneyPanel/);
  });

  it("Send proposal, Create contract, and Change package invoke real actions", () => {
    const panel = readFileSync(resolve("components/booking-journey/booking-journey-panel.tsx"), "utf8");
    assert.match(panel, /sendOfferAction/);
    assert.match(panel, /prepareCreateContractAction/);
    assert.match(panel, /setSelectOpen\(true\)/);
    assert.match(panel, /SelectPackageSheet/);
    assert.doesNotMatch(panel, /coming soon/i);
  });

  it("identity confirmation remains a venue decision", () => {
    const dialog = readFileSync(resolve("components/leads/possible-match-create-dialog.tsx"), "utf8");
    assert.match(dialog, /We may already have this customer/);
    assert.match(dialog, /Use existing customer/);
    assert.match(dialog, /Create new customer/);
    assert.match(dialog, /will not decide for you/);
  });
});
