import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  resolveConsentPhone,
  shouldRecordInquirySmsConsent,
} from "@/lib/communication/apply-inquiry-consent";

describe("inquiry SMS consent recording", () => {
  it("does not treat a phone number alone as consent", () => {
    assert.equal(shouldRecordInquirySmsConsent(false, "+16155551234"), false);
  });

  it("does not treat a Text preference (checkbox off) as consent", () => {
    assert.equal(shouldRecordInquirySmsConsent(false, "615-555-1234"), false);
  });

  it("records consent only when the explicit checkbox is checked and a number is present", () => {
    assert.equal(shouldRecordInquirySmsConsent(true, "+16155551234"), true);
    assert.equal(shouldRecordInquirySmsConsent(true, "   "), false);
    assert.equal(shouldRecordInquirySmsConsent(true, null), false);
  });

  it("prefers the form phone and falls back to the on-file lead phone", () => {
    assert.equal(resolveConsentPhone("(508) 989-6064", "(978) 870-3988"), "(508) 989-6064");
    assert.equal(resolveConsentPhone("  ", "(978) 870-3988"), "(978) 870-3988");
    assert.equal(resolveConsentPhone(null, "(978) 870-3988"), "(978) 870-3988");
    assert.equal(resolveConsentPhone("", null), "");
  });
});

describe("tour / inquiry SMS consent boundaries", () => {
  it("public tour form sends the raw SMS consent checkbox (not cleared when phone looks empty)", () => {
    const form = readFileSync(resolve("components/form/inquiry-form.tsx"), "utf8");
    assert.match(form, /existingLeadTour\?\.phone/);
    assert.doesNotMatch(
      form,
      /smsPermissionGranted:\s*smsPermissionGranted\s*&&\s*!!phone\.trim\(\)/,
    );
    const tourSubmit = form.slice(form.indexOf('fetch("/api/tours/book"'));
    assert.match(tourSubmit, /smsPermissionGranted,/);
  });

  it("existing-lead tour context loads and prefills phone for consent", () => {
    const ctx = readFileSync(resolve("lib/tours/existing-lead-tour-context.ts"), "utf8");
    assert.match(ctx, /phone:\s*string/);
    assert.match(ctx, /\.select\([\s\S]*phone[\s\S]*\)/);
    assert.match(ctx, /phone:\s*\(lead\.phone \?\? ""\)\.trim\(\)/);
  });

  it("tour book route falls back to lead/contact phone and surfaces consent write failures", () => {
    const route = readFileSync(resolve("app/api/tours/book/route.ts"), "utf8");
    assert.match(route, /fallbackPhone/);
    assert.match(route, /applyInquiryCommunicationCapture/);
    assert.match(route, /source:\s*"tour_form"/);
    assert.match(route, /SMS consent not recorded/);
    assert.match(route, /smsPermissionGranted === true/);
  });

  it("public inquire route records inquiry_form consent and logs write failures", () => {
    const route = readFileSync(resolve("app/api/public/inquire/route.ts"), "utf8");
    assert.match(route, /applyInquiryCommunicationCapture/);
    assert.match(route, /source:\s*"inquiry_form"/);
    assert.match(route, /SMS consent not recorded/);
  });

  it("applyInquiryCommunicationCapture checks upsert success and does not invent consent without a phone", () => {
    const apply = readFileSync(resolve("lib/communication/apply-inquiry-consent.ts"), "utf8");
    assert.match(apply, /resolveConsentPhone/);
    assert.match(apply, /if \(!upsert\.ok\)/);
    assert.match(apply, /consentRecorded/);
    assert.doesNotMatch(apply, /preferredChannels.*opted_in|opted_in.*preferredChannels/);
  });
});
