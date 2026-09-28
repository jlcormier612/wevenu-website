import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildProposalCoupleEmail } from "@/lib/commercial-proposals/couple-email";
import { customerFacingVenueName } from "@/lib/venue/identity";

const service = readFileSync(resolve("lib/commercial-proposals/service.ts"), "utf8");
const sheet = readFileSync(resolve("components/booking-journey/create-proposal-sheet.tsx"), "utf8");
const coupleEmailSrc = readFileSync(resolve("lib/commercial-proposals/couple-email.ts"), "utf8");
const offerRpc = readFileSync(resolve("supabase/migrations/20261405800000_commercial_proposals_l1.sql"), "utf8");
const legacyOfferRpc = readFileSync(resolve("supabase/migrations/20261403100000_proposal_acceptance_notice.sql"), "utf8");
const journeyLoad = readFileSync(resolve("lib/booking-journey/load.ts"), "utf8");
const contractPdf = readFileSync(resolve("lib/contracts/pdf.ts"), "utf8");
const invoicePrint = readFileSync(resolve("components/invoices/invoice-print-document.tsx"), "utf8");
const setupSteps = readFileSync(resolve("components/setup/setup-steps.tsx"), "utf8");

const VENUE_NAME = "Jen's Fancy Venue";
const LEGAL_NAME = "Fancy Venue LLC";

describe("proposal couple email", () => {
  it("uses customer-facing venue name in subject, sender-identity copy, and body — never legal business name", () => {
    const venueName = customerFacingVenueName({
      name: VENUE_NAME,
      businessName: LEGAL_NAME,
    });
    const email = buildProposalCoupleEmail({
      venueName,
      recipientFirstName: "Rebecca",
      offerUrl: "https://app.sandbox.hellotocheers.com/offer/abc",
      optionNames: ["Garden Package"],
      offerMessage: "Take a look when you can.",
    });
    assert.equal(email.subject, `${VENUE_NAME} sent you a proposal`);
    assert.match(email.text, /Jen's Fancy Venue sent you a proposal/);
    assert.match(email.text, /A note from Jen's Fancy Venue/);
    assert.match(email.html, /<strong>Jen's Fancy Venue<\/strong> sent you a proposal/);
    assert.doesNotMatch(email.subject, /Fancy Venue LLC/);
    assert.doesNotMatch(email.text, /Fancy Venue LLC/);
    assert.doesNotMatch(email.html, /Fancy Venue LLC/);
  });

  it("resolves venue identity from venues.name, not venues.business_name", () => {
    assert.match(coupleEmailSrc, /customerFacingVenueName/);
    assert.match(coupleEmailSrc, /\.select\("name, email"\)/);
    assert.doesNotMatch(coupleEmailSrc, /business_name/);
  });

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

describe("proposal surfaces use customer-facing name; legal docs keep legal name", () => {
  it("offer page RPC returns venues.name as venueName", () => {
    assert.match(offerRpc, /select v\.name into v_venue_name/);
    assert.match(offerRpc, /'venueName', v_venue_name/);
    assert.doesNotMatch(
      offerRpc.slice(offerRpc.indexOf("get_commercial_proposal_by_accept_token")),
      /v\.business_name into v_venue_name/,
    );
    assert.match(legacyOfferRpc, /select v\.name into v_venue_name/);
  });

  it("staff proposal preview loads venues.name", () => {
    assert.match(journeyLoad, /return venue\?\.name \?\? null;/);
    assert.doesNotMatch(journeyLoad, /venue\?\.businessName/);
  });

  it("settings still distinguish venue name vs legal business name", () => {
    assert.match(setupSteps, /label="Venue name"/);
    assert.match(setupSteps, /label="Legal business name"/);
    assert.match(setupSteps, /Used on contracts and invoices/);
  });

  it("contract PDF still prefers legal business name", () => {
    assert.match(
      contractPdf,
      /brandFields\?\.businessName \|\| brandFields\?\.name \|\| venue\.name \|\| venue\.businessName/,
    );
  });

  it("invoice print still prefers legal business name", () => {
    assert.match(
      invoicePrint,
      /snap\?\.businessName \?\? snap\?\.name \?\? venue\.businessName \?\? venue\.name/,
    );
  });
});
