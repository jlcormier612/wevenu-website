/**
 * Contract venue (and client) phone must use canonical display formatting.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  captureContractBrandingSnapshot,
  resolveContractBrandPresentation,
} from "@/lib/contracts/branding";
import { formatPhoneDisplay, toE164 } from "@/lib/sms/phone";

const service = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
const pdf = readFileSync(resolve("lib/contracts/pdf.ts"), "utf8");
const invoicePrint = readFileSync(resolve("components/invoices/invoice-print-document.tsx"), "utf8");
const leadDetail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
const vendorDetail = readFileSync(resolve("components/vendors/vendor-detail.tsx"), "utf8");
const portalGuide = readFileSync(resolve("components/portal/venue-guide-section.tsx"), "utf8");
const inquiryConfirm = readFileSync(resolve("components/form/inquiry-confirmations.tsx"), "utf8");
const tourScheduler = readFileSync(resolve("components/tours/tour-scheduler.tsx"), "utf8");

describe("contract venue phone display", () => {
  it("merge assembly formats venue and client phones via formatPhoneDisplay", () => {
    assert.match(service, /import \{ formatPhoneDisplay \} from "@\/lib\/sms\/phone"/);
    assert.match(service, /formatPhoneDisplay\(venuePhoneRaw\)/);
    assert.match(service, /formatPhoneDisplay\(clientPhoneRaw\)/);
    assert.match(service, /Phone on file with the venue/);
  });

  it("brand presentation formats phone without rewriting the captured snapshot", () => {
    const venue = {
      name: "Test Venue",
      businessName: null,
      logoUrl: null,
      primaryColor: "#5D6F5D",
      secondaryColor: "#4F5F4F",
      accentColor: "#B8AEA1",
      neutralColor: "#F7F5F1",
      email: "v@example.com",
      phone: "9788703988",
      website: null,
      addressLine1: null,
      addressLine2: null,
    } as Parameters<typeof captureContractBrandingSnapshot>[0];
    const snap = captureContractBrandingSnapshot(venue);
    assert.equal(snap.phone, "9788703988");
    const resolved = resolveContractBrandPresentation(snap, venue);
    assert.equal(resolved?.phone, "(978) 870-3988");
    assert.equal(formatPhoneDisplay("(978) 870-3988"), "(978) 870-3988");
    assert.equal(toE164(snap.phone ?? ""), "+19788703988");
  });

  it("PDF contact line formats phone via brand resolution or formatPhoneDisplay", () => {
    assert.match(pdf, /formatPhoneDisplay/);
    assert.match(pdf, /contactPhone/);
  });

  it("handles empty, already-formatted, and international values safely", () => {
    assert.equal(formatPhoneDisplay(""), "");
    assert.equal(formatPhoneDisplay("9788703988"), "(978) 870-3988");
    assert.equal(formatPhoneDisplay("(978) 870-3988"), "(978) 870-3988");
    assert.equal(formatPhoneDisplay("+442071234567"), "+442071234567");
    assert.equal(
      resolveContractBrandPresentation(null, { phone: null, name: "X" })?.phone,
      null,
    );
  });
});

describe("platform phone-display audit surfaces", () => {
  it("lead, vendor, invoice, portal, inquiry, and tour confirmation use formatPhoneDisplay", () => {
    assert.match(leadDetail, /formatPhoneDisplay\(lead\.phone\)/);
    assert.match(vendorDetail, /formatPhoneDisplay\(vendor\.phone\)/);
    assert.match(invoicePrint, /formatPhoneDisplay\(phoneRaw\)/);
    assert.match(portalGuide, /formatPhoneDisplay\(contact\.phone\)/);
    assert.match(inquiryConfirm, /formatPhoneDisplay\(confirmation\.venuePhone\)/);
    assert.match(tourScheduler, /formatPhoneDisplay\(venuePhone\)/);
  });
});
