import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Customer-facing Offer → Proposal terminology", () => {
  const files = [
    "lib/booking-journey/model.ts",
    "components/booking-journey/booking-journey-panel.tsx",
    "components/booking-journey/offer-accept-client.tsx",
    "components/settings/commercial-booking-prefs-section.tsx",
    "lib/commercial-selections/constants.ts",
    "app/offer/[token]/page.tsx",
  ];

  it("booking surfaces say Proposal, not Send offer", () => {
    for (const file of files) {
      const src = readFileSync(resolve(file), "utf8");
      assert.doesNotMatch(src, /Send offer/, file);
      assert.doesNotMatch(src, />Your offer</, file);
    }
    const panel = readFileSync(resolve("components/booking-journey/booking-journey-panel.tsx"), "utf8");
    assert.match(panel, /Send proposal/);
    assert.match(panel, /Review proposal/);
    const model = readFileSync(resolve("lib/booking-journey/model.ts"), "utf8");
    assert.match(model, /primaryLabel = "Send proposal"/);
    const couple = readFileSync(resolve("components/booking-journey/offer-accept-client.tsx"), "utf8");
    assert.match(couple, /Accept proposal/);
    const artifact = readFileSync(resolve("components/booking-journey/proposal-artifact.tsx"), "utf8");
    assert.match(artifact, /Your proposal/);
    const labels = readFileSync(resolve("lib/commercial-selections/constants.ts"), "utf8");
    assert.match(labels, /Proposal sent/);
    assert.match(labels, /Proposal accepted/);
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
