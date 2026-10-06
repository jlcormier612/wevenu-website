/**
 * Customer-facing email branding closeout — the 12 remaining types
 * plus the already-green tour reminder. Staff/platform emails must stay HTC.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildSmsConsentEmailBodies } from "@/lib/communication/sms-consent-email";
import { emailBrandFromVenue } from "@/lib/email/venue-brand";
import { buildTeamInviteHtml } from "@/lib/email/team-invite";
import { buildVendorInviteHtml } from "@/lib/email/vendor-invite";
import { buildInvoiceDocumentEmail } from "@/lib/invoices/invoice-document-email";
import { buildInvoiceAndPaymentPlanEmail } from "@/lib/invoices/invoice-and-payment-plan-email";
import { buildPaymentRequestEmail } from "@/lib/invoices/payment-request-email";
import { buildReminderEmail } from "@/lib/notifications/templates";
import { buildTourReminderCoupleEmail } from "@/lib/notifications/tour-reminder-email";
import {
  previewTourConfirmation,
  previewTourConfirmationRequest,
  previewTourScheduled,
} from "@/lib/tours/communication";

const LOGO = "https://cdn.example.test/venues/fancy-logo.png";
const brand = emailBrandFromVenue({
  name: "Jen's Fancy Venue",
  logo_url: LOGO,
  primary_color: "#8B4513",
  email_signature: "Warmly,\nJen's Fancy Venue",
  email: "hello@fancy.test",
  phone: "555-0100",
});
const noLogoBrand = emailBrandFromVenue({
  name: "No Logo Venue",
  logo_url: null,
  primary_color: "#5D6F5D",
});

const tourParams = {
  venueId: "venue",
  leadId: "lead",
  relationshipId: "rel",
  contactEmail: "alex@example.com",
  contactName: "Alex Rivera",
  venueName: "Jen's Fancy Venue",
  primaryColor: "#8B4513",
  brand,
  scheduledAt: "2027-06-14T18:00:00.000Z",
  durationMinutes: 60,
  timezone: "America/New_York",
};

function assertVenueShell(html: string, opts: { logo: boolean; venueName: string; color: string }) {
  assert.match(html, new RegExp(opts.venueName.replace(/'/g, "(&#39;|')")));
  assert.match(html, new RegExp(`border-top:4px solid ${opts.color}`));
  assert.doesNotMatch(html, /hello-to-cheers-logo/);
  assert.doesNotMatch(html, /alt="Hello to Cheers"/);
  if (opts.logo) {
    assert.match(html, /cdn\.example\.test\/venues\/fancy-logo\.png/);
  } else {
    assert.doesNotMatch(html, /<img /);
  }
}

describe("customer-facing email branding closeout", () => {
  it("1. tour scheduled uses shared shell + logo", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    const preview = previewTourScheduled({ ...tourParams, confirmToken: "tok_sched" });
    assert.match(preview.subject, /Your tour is scheduled/);
    assert.match(preview.body, /You're scheduled for a 60-minute tour at Jen's Fancy Venue/);
    assert.match(preview.html, /Confirm my tour/);
    assertVenueShell(preview.html, { logo: true, venueName: "Jen's Fancy Venue", color: "#8B4513" });
    assert.match(preview.html, /hello@fancy\.test/);
  });

  it("2. tour confirmation request uses shared shell + logo", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    const preview = previewTourConfirmationRequest({ ...tourParams, confirmToken: "tok_abc" });
    assert.match(preview.subject, /Please confirm your tour/);
    assert.match(preview.body, /Please confirm your upcoming 60-minute tour/);
    assertVenueShell(preview.html, { logo: true, venueName: "Jen's Fancy Venue", color: "#8B4513" });
  });

  it("3. tour confirmed uses shared shell + logo", () => {
    const preview = previewTourConfirmation(tourParams);
    assert.match(preview.subject, /Tour confirmed/);
    assert.match(preview.body, /is confirmed/);
    assert.match(preview.html, /Add to Calendar/);
    assertVenueShell(preview.html, { logo: true, venueName: "Jen's Fancy Venue", color: "#8B4513" });
  });

  it("tour emails with no logo omit img and never fall back to HTC", () => {
    const preview = previewTourConfirmation({
      ...tourParams,
      venueName: "No Logo Venue",
      brand: noLogoBrand,
      primaryColor: "#5D6F5D",
    });
    assertVenueShell(preview.html, { logo: false, venueName: "No Logo Venue", color: "#5D6F5D" });
  });

  it("4. planning-task reminder to couple uses shared shell; coordinator stays HTC", () => {
    const couple = buildReminderEmail({
      taskTitle: "Send contract",
      eventName: "The Garden Wedding",
      eventDate: "2026-10-10",
      dueDate: "2026-12-01",
      role: "couple",
      reminderType: "due_soon",
      portalToken: "tok_portal",
      venueBaseUrl: "https://app.example.com",
      venueName: "Jen's Fancy Venue",
      venueColor: "#8B4513",
      brand,
    });
    assert.match(couple.subject, /Send contract/);
    assert.match(couple.text, /Send contract/);
    assertVenueShell(couple.html, { logo: true, venueName: "Jen's Fancy Venue", color: "#8B4513" });
    assert.match(couple.html, /View your planning workspace/);

    const staff = buildReminderEmail({
      taskTitle: "Send contract",
      eventName: "The Garden Wedding",
      eventDate: "2026-10-10",
      dueDate: "2026-12-01",
      role: "coordinator",
      reminderType: "due_soon",
      venueBaseUrl: "https://app.example.com",
      venueName: "Jen's Fancy Venue",
      venueColor: "#8B4513",
      brand,
    });
    assert.match(staff.html, /alt="Hello to Cheers"/);
    assert.match(staff.html, /hello-to-cheers-logo-primary-transparent\.png/);
  });

  it("5. payment-request builder uses shared shell + logo", () => {
    const out = buildPaymentRequestEmail({
      clientFirstName: "Lucy",
      clientEmail: "lucy@example.com",
      venueName: "Jen's Fancy Venue",
      venueEmail: "hello@fancy.test",
      invoiceLabel: "Wedding invoice",
      invoiceNumber: "INV-1",
      dueNow: {
        kind: "next_installment",
        amount: 500,
        dueDate: "2026-11-01",
        label: "Deposit",
        obligationKind: "deposit",
      },
      dueDate: "November 1, 2026",
      totalContracted: 32000,
      paidToDate: 0,
      remainingAfter: 31500,
      balanceDue: 32000,
      portalPayUrl: "https://example.test/pay",
      brand,
    });
    assert.equal(out.subject, "Your Wedding invoice payment request — Jen's Fancy Venue");
    assert.match(out.text, /requesting payment for your Wedding invoice/);
    assert.match(out.html, /Pay \$500\.00/);
    assertVenueShell(out.html, { logo: true, venueName: "Jen's Fancy Venue", color: "#8B4513" });
  });

  it("live payment-request send path is already the branded Invoice & Payment Plan email", () => {
    const out = buildInvoiceAndPaymentPlanEmail({
      clientFirstName: "Lucy",
      clientEmail: "lucy@example.com",
      clientName: "Lucy Peanut",
      venueName: "Jen's Fancy Venue",
      venueEmail: "hello@fancy.test",
      invoiceLabel: "Wedding invoice",
      invoiceNumber: "INV-1",
      eventDate: "2026-07-04",
      totalContracted: 32000,
      paidToDate: 0,
      balanceDue: 32000,
      dueNow: {
        kind: "next_installment",
        amount: 500,
        dueDate: "2026-11-01",
        label: "Deposit",
        obligationKind: "deposit",
      },
      dueDateLabel: "November 1, 2026",
      remainingAfter: 31500,
      scheduleLines: [],
      invoicePlanUrl: "https://example.test/p/fin",
      brand,
    });
    assertVenueShell(out.html, { logo: true, venueName: "Jen's Fancy Venue", color: "#8B4513" });
    assert.match(out.html, /View Invoice &amp; Payment Plan/);
  });

  it("6. invoice-document copy uses shared shell + logo and keeps schedule table", () => {
    const out = buildInvoiceDocumentEmail({
      clientFirstName: "Lucy",
      clientEmail: "lucy@example.com",
      clientName: "Lucy Peanut",
      venueName: "Jen's Fancy Venue",
      venueEmail: "hello@fancy.test",
      invoiceLabel: "Wedding invoice",
      invoiceNumber: "INV-1",
      eventDate: "2026-07-04",
      totalContracted: 32000,
      paidToDate: 0,
      balanceDue: 32000,
      scheduleLines: [{ label: "Deposit", amount: 500, dueDate: "2026-11-01", status: "pending" }],
      documentsUrl: "https://example.test/docs",
      brand,
    });
    assert.equal(out.subject, "Your payment plan and invoice — Jen's Fancy Venue");
    assert.match(out.text, /has shared your payment plan and invoice/);
    assert.match(out.html, /<table/);
    assert.match(out.html, /Deposit/);
    assertVenueShell(out.html, { logo: true, venueName: "Jen's Fancy Venue", color: "#8B4513" });
  });

  it("7. SMS consent request email uses shared shell + logo", () => {
    const out = buildSmsConsentEmailBodies({
      venueName: "Jen's Fancy Venue",
      firstName: "Alex",
      consentUrl: "https://example.test/sms-consent/abc",
      brand,
    });
    assert.match(out.subject, /text message permission/);
    assert.match(out.text, /not opted in yet/);
    assert.match(out.html, /Review text permission/);
    assertVenueShell(out.html, { logo: true, venueName: "Jen's Fancy Venue", color: "#8B4513" });
  });

  it("8–12. brochure / workspace invite / contact invite / questionnaire / Event Order use shared shell", () => {
    const brochure = readFileSync(resolve("lib/brochures/service.ts"), "utf8");
    assert.match(brochure, /renderBrandedEmailHtml\(emailBrandFromVenue\(venue\)/);
    assert.match(brochure, /View \$\{escapeHtml\(brochure\.name\)\}/);

    const clientInvite = readFileSync(resolve("lib/client-auth/service.ts"), "utf8");
    assert.match(clientInvite, /html: renderBrandedEmailHtml\(brand/);
    assert.match(clientInvite, /Create Your Account/);
    assert.match(clientInvite, /Hello to Cheers is where you'll keep/);

    const contact = readFileSync(resolve("lib/contacts/service.ts"), "utf8");
    assert.match(contact, /html: renderBrandedEmailHtml\(brand/);
    assert.match(contact, /Open Planning Portal/);

    const questionnaire = readFileSync(resolve("lib/events/questionnaire.ts"), "utf8");
    assert.match(questionnaire, /html: wrapConversationMessageHtml\(brand, text\)/);

    const eo = readFileSync(resolve("lib/event-orders/representation.ts"), "utf8");
    assert.match(eo, /html: wrapConversationMessageHtml\(emailBrandFromVenue\(venue\), text\)/);
  });

  it("previously fixed tour reminder remains branded", () => {
    const out = buildTourReminderCoupleEmail({
      brand,
      dateLabel: "Wednesday, October 7, 2026",
      timeLabel: "10:45 AM",
    });
    assert.match(out.subject, /Your tour at Jen's Fancy Venue is tomorrow/);
    assertVenueShell(out.html, { logo: true, venueName: "Jen's Fancy Venue", color: "#8B4513" });
    assert.match(out.html, /look forward to meeting you/);
  });

  it("staff/platform emails remain Hello to Cheers branded", () => {
    const team = buildTeamInviteHtml({
      memberName: "Sam",
      venueName: "Jen's Fancy Venue",
      acceptUrl: "https://example.test/accept",
    });
    assert.match(team, /hello-to-cheers-logo-primary-transparent\.png/);
    assert.match(team, /alt="Hello to Cheers"/);

    const vendor = buildVendorInviteHtml({
      vendorName: "Florist Co",
      venueName: "Jen's Fancy Venue",
      acceptUrl: "https://example.test/vendor",
    });
    assert.match(vendor, /hello-to-cheers-logo-primary-transparent\.png/);
  });
});
