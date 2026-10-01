/**
 * Invoice & Payment Plan customer journey — email CTA + financial-token page.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { buildInvoiceAndPaymentPlanEmail } from "@/lib/invoices/invoice-and-payment-plan-email";
import { emailBrandFromVenue } from "@/lib/email/venue-brand";

const emailSrc = readFileSync(resolve("lib/invoices/invoice-and-payment-plan-email.ts"), "utf8");
const outboundSrc = readFileSync(resolve("lib/invoices/outbound.ts"), "utf8");
const actionsSrc = readFileSync(resolve("app/(app)/invoices/actions.ts"), "utf8");
const shellSrc = readFileSync(resolve("components/portal/payment-access-shell.tsx"), "utf8");
const pageSrc = readFileSync(resolve("app/(portal)/p/[token]/page.tsx"), "utf8");
const paymentsApi = readFileSync(resolve("app/api/portal/payments/route.ts"), "utf8");
const checkoutApi = readFileSync(resolve("app/api/portal/checkout/route.ts"), "utf8");

const PLAN_URL = "https://example.test/p/fin-token?item=pay-1";
const brand = emailBrandFromVenue({
  name: "Jen's Fancy Venue",
  primaryColor: "#E8A0BF",
  email: "venue@example.com",
});

function sampleEmail(overrides: Partial<Parameters<typeof buildInvoiceAndPaymentPlanEmail>[0]> = {}) {
  return buildInvoiceAndPaymentPlanEmail({
    clientFirstName: "Lucy",
    clientEmail: "lucy@example.com",
    clientName: "Lucy Peanut & Charlie Brown",
    venueName: "Jen's Fancy Venue",
    venueEmail: "venue@example.com",
    invoiceLabel: "Wedding invoice",
    invoiceNumber: "INV-2026-B0E9C5",
    eventDate: "2026-07-04",
    totalContracted: 32000,
    paidToDate: 0,
    balanceDue: 32000,
    dueNow: {
      kind: "next_installment",
      amount: 8000,
      dueDate: "2026-10-01",
      label: "Initial Payment",
      obligationKind: "deposit",
    },
    dueDateLabel: "October 1, 2026",
    remainingAfter: 24000,
    scheduleLines: [
      { label: "Initial Payment", amount: 8000, dueDate: "2026-10-01", status: "pending" },
      { label: "Final Payment", amount: 24000, dueDate: "2026-12-01", status: "pending" },
    ],
    invoicePlanUrl: PLAN_URL,
    brand,
    ...overrides,
  });
}

describe("Invoice & Payment Plan email — single financial CTA", () => {
  it("HTML has branded View Invoice & Payment Plan CTA to the financial URL", () => {
    const email = sampleEmail();
    assert.match(email.html, /View Invoice &amp; Payment Plan|View Invoice & Payment Plan/);
    assert.match(email.html, new RegExp(PLAN_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(email.html, /background:#E8A0BF/);
    assert.match(email.html, /Initial Payment: \$8,000\.00/);
    assert.match(email.html, /Due October 1, 2026/);
  });

  it("does not use View your documents or couple portal Documents URLs", () => {
    const email = sampleEmail();
    assert.doesNotMatch(email.html, /View your documents/i);
    assert.doesNotMatch(email.text, /View your documents/i);
    assert.doesNotMatch(email.html, /#documents/);
    assert.doesNotMatch(email.text, /#documents/);
    assert.equal(email.documentsUrl, null);
  });

  it("does not duplicate a Pay-now CTA in the email", () => {
    const email = sampleEmail();
    assert.doesNotMatch(email.html, />Pay \$8,000\.00 now</);
    assert.doesNotMatch(email.text, /^Pay now:/m);
    assert.equal(email.paymentUrl, null);
  });

  it("plaintext includes the same customer-facing invoice URL", () => {
    const email = sampleEmail();
    assert.match(email.text, /View Invoice & Payment Plan:/);
    assert.match(email.text, new RegExp(PLAN_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(email.text, /Initial Payment: \$8,000\.00/);
    assert.match(email.text, /Due October 1, 2026/);
  });

  it("future installment stays factual without a pay CTA in email", () => {
    const email = sampleEmail({
      dueNow: {
        kind: "scheduled_future",
        amount: 8000,
        dueDate: "2026-12-01",
        label: "Initial Payment",
        obligationKind: "deposit",
      },
      dueDateLabel: null,
      invoicePlanUrl: "https://example.test/p/fin-token",
    });
    assert.match(email.html, /View Invoice &amp; Payment Plan|View Invoice & Payment Plan/);
    assert.doesNotMatch(email.html, />Pay \$/);
    assert.match(email.text, /not due yet/);
  });
});

describe("Invoice & Payment Plan access — financial token only", () => {
  it("outbound always creates financial session and never couple Documents for this send", () => {
    assert.match(outboundSrc, /createPortalSession\(clientId, "Payment", "financial"\)/);
    assert.doesNotMatch(outboundSrc, /ensureCoupleDocuments/);
    assert.doesNotMatch(outboundSrc, /createPortalSession\(clientId, "Documents", "couple"\)/);
    assert.doesNotMatch(outboundSrc, /#documents/);
    assert.match(outboundSrc, /invoicePlanUrl/);
    assert.doesNotMatch(actionsSrc, /ensureCoupleDocuments/);
  });

  it("portal page keeps financial token on PaymentAccessShell (not PortalShell)", () => {
    assert.match(pageSrc, /accessLevel === "financial"/);
    assert.match(pageSrc, /PaymentAccessShell/);
    const defaultExport = pageSrc.slice(pageSrc.indexOf("export default async function PortalPage"));
    const finIdx = defaultExport.indexOf('accessLevel === "financial"');
    const afterFin = defaultExport.slice(finIdx, defaultExport.indexOf("const [tasks, vendorTasks"));
    assert.match(afterFin, /PaymentAccessShell/);
    assert.doesNotMatch(afterFin, /PortalShell/);
    assert.doesNotMatch(afterFin, /resolvePortalLegalGate/);
  });

  it("customer page is invoice/payment-plan presentation with authoritative checkout", () => {
    assert.match(shellSrc, /Invoice &amp; Payment Plan/);
    assert.match(shellSrc, /data-testid="invoice-payment-plan-header"/);
    assert.match(shellSrc, /data-testid="invoice-schedule-line"/);
    assert.match(shellSrc, /Pay \$\{formatCurrency\(payableLine\.amount\)\} Now/);
    assert.match(shellSrc, /\/api\/portal\/checkout/);
    assert.match(shellSrc, /itemId: payableLine\.id/);
    assert.match(shellSrc, /resolveAmountDueNow/);
    assert.doesNotMatch(shellSrc, /Tasks/);
    assert.doesNotMatch(shellSrc, /Timeline/);
    assert.doesNotMatch(shellSrc, /Floor Plan/);
    assert.doesNotMatch(shellSrc, /Vendors/);
    assert.match(checkoutApi, /export async function POST/);
    assert.match(paymentsApi, /businessToday/);
  });

  it("email builder uses shared branded shell helpers", () => {
    assert.match(emailSrc, /brandButtonHtml/);
    assert.match(emailSrc, /renderBrandedEmailHtml/);
    assert.match(emailSrc, /invoicePlanUrl/);
    assert.doesNotMatch(emailSrc, /View your documents/);
  });
});
