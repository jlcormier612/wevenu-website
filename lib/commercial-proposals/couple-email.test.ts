import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildProposalCoupleEmail } from "@/lib/commercial-proposals/couple-email";

const service = readFileSync(resolve("lib/commercial-proposals/service.ts"), "utf8");
const sheet = readFileSync(resolve("components/booking-journey/create-proposal-sheet.tsx"), "utf8");

describe("proposal couple email", () => {
  it("tells the couple they can review and choose, and does not call it a contract", () => {
    const email = buildProposalCoupleEmail({
      venueName: "Jen's Fancy Venue",
      recipientFirstName: "Rebecca",
      offerUrl: "https://app.sandbox.hellotocheers.com/offer/abc",
      optionNames: ["Garden Package"],
      offerMessage: "Take a look when you can.",
    });
    assert.match(email.subject, /sent you a proposal/);
    assert.match(email.text, /review/i);
    assert.match(email.text, /choose/);
    assert.match(email.text, /\/offer\/abc/);
    assert.match(email.text, /does not sign a contract/);
    assert.doesNotMatch(email.text, /fully executed|contract is signed|automatically/i);
    assert.match(email.text, /Garden Package/);
  });

  it("send publishes then submits email and surfaces a failed submit", () => {
    assert.match(service, /submitProposalCoupleEmail/);
    assert.match(service, /emailSubmitted: email\.submitted/);
    assert.match(sheet, /email was not submitted/);
    assert.match(sheet, /Resend email/);
    assert.match(sheet, /Copy link/);
  });
});