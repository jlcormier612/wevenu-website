/**
 * P2-C — Client Choices selection-request email content + contracts.
 * Run: npx tsx --test lib/client-choices/couple-email.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { buildChoicesCoupleEmail } from "@/lib/client-choices/couple-email";

describe("P2-C buildChoicesCoupleEmail", () => {
  it("includes secure portal choices deep link and no booking claim", () => {
    const content = buildChoicesCoupleEmail({
      venueName: "Jen’s Fancy Venue",
      recipientFirstName: "Alex",
      choicesName: "Bar package",
      eventName: "Perry/West",
      portalUrl: "https://app.sandbox.hellotocheers.com/p/tok_test#choices",
      offerMessage: "Please pick by Friday.",
    });
    assert.match(content.subject, /selections to review/i);
    assert.match(content.text, /tok_test#choices/);
    assert.match(content.text, /Bar package/);
    assert.match(content.text, /Please pick by Friday/);
    assert.match(content.text, /does not change your booking/i);
    assert.doesNotMatch(content.text, /email was sent/i);
    assert.match(content.html, /Review your selections/);
    assert.match(content.html, /#choices/);
  });

  it("does not import commercial_proposals tables or modules", () => {
    const src = readFileSync(resolve("lib/client-choices/couple-email.ts"), "utf8");
    assert.doesNotMatch(src, /from ["']@\/lib\/commercial-proposals/);
    assert.match(src, /sendEmail/);
    assert.match(src, /recordExternalClientOutbound/);
    assert.match(src, /sourceType: "client_choices_request"/);
    assert.match(src, /choicesReviewUrl/);
    assert.doesNotMatch(src, /sessions\[0\]/);
  });
});

describe("P2-C send wiring", () => {
  it("service exposes sendClientChoicesRequest after portal send", () => {
    const src = readFileSync(resolve("lib/client-choices/service.ts"), "utf8");
    assert.match(src, /export async function sendClientChoicesRequest/);
    assert.match(src, /sendClientChoices\(choicesId\)/);
    assert.match(src, /submitClientChoicesCoupleEmail/);
    assert.match(src, /email_submitted|email_not_submitted/);
  });

  it("panel opens ShareDialog for selection request and keeps portal-only secondary", () => {
    const panel = readFileSync(
      resolve("components/client-choices/client-choices-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /ShareDialog/);
    assert.match(panel, /sendClientChoicesRequestAction/);
    assert.match(panel, /choices-send-selection-request/);
    assert.match(panel, /choices-portal-only/);
    assert.match(panel, /No email was sent/);
    assert.match(panel, /This is a preview — nothing has been sent/i);
    assert.match(panel, /does not finalize the Event Order, create an invoice/i);
  });

  it("ShareDialog success requires email.submitted; portal-ready alone is not success", () => {
    const panel = readFileSync(
      resolve("components/client-choices/client-choices-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /!r\.email\.submitted/);
    assert.match(panel, /Available in the couple/);
  });

  it("action revalidates event after request send", () => {
    const actions = readFileSync(
      resolve("app/(app)/events/[id]/client-choices-actions.ts"),
      "utf8",
    );
    assert.match(actions, /sendClientChoicesRequestAction/);
    assert.match(actions, /sendClientChoicesRequest/);
  });
});
