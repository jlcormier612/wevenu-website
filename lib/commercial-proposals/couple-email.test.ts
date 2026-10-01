import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildProposalCoupleEmail } from "@/lib/commercial-proposals/couple-email";
import { brandButtonHtml, emailBrandFromVenue } from "@/lib/email/venue-brand";
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
const OFFER_URL = "https://app.sandbox.hellotocheers.com/offer/abc";

describe("proposal couple email", () => {
  it("uses customer-facing venue name in subject, sender-identity copy, and body — never legal business name", () => {
    const venueName = customerFacingVenueName({
      name: VENUE_NAME,
      businessName: LEGAL_NAME,
    });
    const email = buildProposalCoupleEmail({
      venueName,
      recipientFirstName: "Rebecca",
      offerUrl: OFFER_URL,
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
    assert.match(coupleEmailSrc, /\.select\("name, logo_url, primary_color, email_signature, email, phone"\)/);
    assert.doesNotMatch(coupleEmailSrc, /business_name/);
  });

  it("tells the couple they can review and choose, and does not call it a contract", () => {
    const email = buildProposalCoupleEmail({
      venueName: "Jen's Fancy Venue",
      recipientFirstName: "Rebecca",
      offerUrl: OFFER_URL,
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

  it("HTML uses branded shell + Review your proposal CTA with exact offer href and no raw URL fallback", () => {
    const brand = emailBrandFromVenue({
      name: VENUE_NAME,
      primaryColor: "#5D6F5D",
      logoUrl: "https://cdn.example.com/logo.png",
    });
    const email = buildProposalCoupleEmail({
      venueName: VENUE_NAME,
      recipientFirstName: "Rebecca",
      offerUrl: OFFER_URL,
      optionNames: ["Essential Wedding", "Signature Wedding"],
      offerMessage: "Take a look when you can.",
      brand,
    });

    // Branded shell
    assert.match(email.html, /<!DOCTYPE html>/);
    assert.match(email.html, /border-top:4px solid #5D6F5D/);
    assert.match(email.html, /Jen's Fancy Venue/);

    // CTA matches brandButtonHtml helper exactly
    const expectedCta = brandButtonHtml(brand, OFFER_URL, "Review your proposal");
    assert.ok(email.html.includes(expectedCta), "html must embed brandButtonHtml CTA");
    assert.match(
      email.html,
      /href="https:\/\/app\.sandbox\.hellotocheers\.com\/offer\/abc"[^>]*>Review your proposal<\/a>/,
    );

    // Offer URL appears only as the CTA href — not as a second visible body fallback
    const hrefOccurrences = email.html.split(`href="${OFFER_URL}"`).length - 1;
    assert.equal(hrefOccurrences, 1, "offer URL should appear once as CTA href");
    assert.equal(
      email.html.includes(`>${OFFER_URL}<`),
      false,
      "raw offer URL must not appear as visible HTML text",
    );
    assert.doesNotMatch(email.html, /font-size:12px;color:#666/);

    // Existing proposal content preserved
    assert.match(email.html, /sent you a proposal/);
    assert.match(email.html, /Open it to review the options/);
    assert.match(email.html, /Essential Wedding/);
    assert.match(email.html, /Signature Wedding/);
    assert.match(email.html, /does not sign a contract/);
    assert.match(email.html, /Take a look when you can/);
  });

  it("plaintext multipart still contains the bare offer URL", () => {
    const email = buildProposalCoupleEmail({
      venueName: VENUE_NAME,
      recipientFirstName: "Rebecca",
      offerUrl: OFFER_URL,
      optionNames: ["Garden Package"],
    });
    assert.match(email.text, new RegExp(OFFER_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(email.text, /Open it to review the options and choose the one you want:/);
  });

  it("reuses shared venue-brand helpers rather than duplicating CTA/shell markup", () => {
    assert.match(coupleEmailSrc, /brandButtonHtml/);
    assert.match(coupleEmailSrc, /renderBrandedEmailHtml/);
    assert.match(coupleEmailSrc, /emailBrandFromVenue/);
    assert.doesNotMatch(coupleEmailSrc, /display:inline-block;background:#1a1a1a/);
  });

  it("send publishes then submits email and surfaces a failed submit", () => {
    assert.match(service, /submitProposalCoupleEmail/);
    assert.match(service, /emailSubmitted: email\.submitted/);
    assert.match(sheet, /email was not submitted/);
    assert.match(sheet, /Resend email/);
    assert.match(sheet, /Copy link/);
  });

  it("send/resend still call the same submitProposalCoupleEmail path", () => {
    assert.match(service, /export async function sendCommercialProposal/);
    assert.match(service, /export async function resendCommercialProposalEmail/);
    assert.equal(
      (service.match(/submitProposalCoupleEmail/g) ?? []).length >= 2,
      true,
      "send and resend both import/call submitProposalCoupleEmail",
    );
    assert.match(
      service,
      /Resend the couple email for an already-sent proposal\. Does not change status or token/,
    );
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
