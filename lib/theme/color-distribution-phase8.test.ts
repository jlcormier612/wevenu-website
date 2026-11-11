/**
 * Phase 8 — Contracts & Payments Balanced Hospitality chrome.
 * Structural seams only; no workflow/data assertions.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Phase 8 Contracts & Payments Balanced Hospitality", () => {
  const css = read("app/globals.css");
  const contractsPage = read("app/(app)/contracts/page.tsx");
  const paymentsPage = read("app/(app)/payments/page.tsx");
  const contractList = read("components/contracts/contract-list.tsx");
  const paymentList = read("components/payments/payment-schedule-list.tsx");

  it("defines eucalyptus intro utility without replacing white heading", () => {
    assert.match(css, /\.htc-staff \.htc-hospitality-intro/);
    assert.match(css, /\.htc-staff \.htc-hospitality-intro \{[\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/);
    assert.match(css, /\.htc-staff \.htc-hospitality-heading \{[\s\S]*?background:\s*var\(--card\)/);
  });

  it("Contracts list page uses hospitality page + white heading strip with actions inside", () => {
    assert.match(contractsPage, /htc-hospitality-page/);
    assert.match(contractsPage, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(contractsPage, /data-htc-phase8="contracts"/);
    assert.match(contractsPage, /Which contracts need something from me\?/);
    assert.match(contractsPage, /Templates/);
    assert.match(contractsPage, /\+ New Contract/);
    // Actions remain nested inside the primary heading region.
    const introIdx = contractsPage.indexOf("htc-hospitality-heading htc-hospitality-intro-accent");
    const templatesIdx = contractsPage.indexOf("Templates");
    const closeIntro = contractsPage.indexOf("</div>", introIdx);
    assert.ok(introIdx >= 0 && templatesIdx > introIdx && templatesIdx < closeIntro + 200);
    assert.doesNotMatch(contractsPage, /Hospitality chrome exploration/i);
    assert.doesNotMatch(contractsPage, /Balanced Hospitality/i);
    assert.doesNotMatch(contractsPage, /Option B/i);
  });

  it("Payments list page uses hospitality page + white heading strip with New Schedule inside", () => {
    assert.match(paymentsPage, /htc-hospitality-page/);
    assert.match(paymentsPage, /htc-hospitality-heading htc-hospitality-intro-accent/);
    assert.match(paymentsPage, /data-htc-phase8="payments"/);
    assert.match(paymentsPage, /Track deposits, installments, and outstanding balances/);
    assert.match(paymentsPage, /\+ New Schedule/);
    assert.match(paymentsPage, /SpotPatternRecommendationsPanel/);
    assert.doesNotMatch(paymentsPage, /Hospitality chrome exploration/i);
    assert.doesNotMatch(paymentsPage, /summary-card|Outstanding|Balances due/);
  });

  it("Contract and payment lists reuse toolbar + table hospitality classes", () => {
    assert.match(contractList, /htc-hospitality-toolbar/);
    assert.match(contractList, /htc-hospitality-table/);
    assert.match(contractList, /Search contracts/);
    assert.match(contractList, /CONTRACT_LIST_FILTERS/);
    assert.match(contractList, /sm:hidden/);
    assert.match(paymentList, /htc-hospitality-toolbar/);
    assert.match(paymentList, /htc-hospitality-table/);
    assert.match(paymentList, /Search schedules/);
    assert.match(paymentList, /PAYMENT_LIST_FILTERS/);
  });

  it("does not invent linen explanatory strips on these pages", () => {
    assert.doesNotMatch(contractsPage, /htc-linen|F3F0E9|linen-note/);
    assert.doesNotMatch(paymentsPage, /htc-linen|F3F0E9|linen-note/);
    assert.doesNotMatch(contractList, /Hospitality chrome exploration/i);
    assert.doesNotMatch(paymentList, /Hospitality chrome exploration/i);
  });

  it("preserves existing list filter and navigation behavior seams", () => {
    assert.match(contractList, /contractMatchesListFilter/);
    assert.match(contractList, /contractMatchesWorkflowSearch/);
    assert.match(contractList, /\/contracts\/\$\{contract\.id\}/);
    assert.match(paymentList, /paymentMatchesListFilter/);
    assert.match(paymentList, /paymentMatchesListSearch/);
    assert.match(paymentList, /\/payments\/\$\{s\.id\}/);
    assert.match(paymentList, /formatMoney\(s\.totalAmount\)/);
    assert.match(paymentList, /ScheduleStatusBadge/);
  });
});
