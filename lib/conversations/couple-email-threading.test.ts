/**
 * Source regressions: couple-facing invoice / obligation / engine reminders
 * pass threadId like proposal and contract (established Pattern A).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

describe("invoice payment-plan emails carry threadId", () => {
  const src = readFileSync(resolve("app/(app)/invoices/actions.ts"), "utf8");

  it("first send and revised send resolve venue↔couple conversation and pass threadId", () => {
    const first = src.slice(
      src.indexOf("export async function sendInvoiceAndPaymentPlanAction"),
      src.indexOf("export async function previewRevisedInvoiceAndPaymentPlanAction"),
    );
    const revised = src.slice(
      src.indexOf("export async function sendRevisedInvoiceAndPaymentPlanAction"),
      src.indexOf("export async function sendInvoiceEmailAction"),
    );
    for (const site of [first, revised]) {
      assert.match(site, /resolveVenueCoupleThreadId/);
      assert.match(site, /threadId: threadId \?\? undefined/);
      assert.match(site, /replyTo: email\.replyTo/);
      assert.match(site, /recordExternalClientOutbound/);
    }
  });
});

describe("obligation couple reminders carry threadId", () => {
  const src = readFileSync(resolve("lib/notifications/obligation-engine.ts"), "utf8");

  it("payment and contract reminder sends pass threadId without changing staff dispatch", () => {
    const payment = src.slice(
      src.indexOf("async function processPaymentReminders"),
      src.indexOf("async function processContractReminders"),
    );
    const contract = src.slice(
      src.indexOf("async function processContractReminders"),
      src.indexOf("export async function processObligationTransitions"),
    );
    for (const site of [payment, contract]) {
      assert.match(site, /resolveVenueCoupleThreadId/);
      assert.match(site, /threadId: threadId \?\? undefined/);
      assert.match(site, /replyTo: venue\?\.email \?\? undefined/);
      assert.match(site, /recordExternalClientOutbound/);
    }
    const staff = src.slice(src.indexOf("async function dispatchMessageReceivedEmail"));
    assert.doesNotMatch(staff, /threadId:/);
  });
});

describe("notifications engine couple reminders use sendEmail + threadId", () => {
  const src = readFileSync(resolve("lib/notifications/engine.ts"), "utf8");

  it("couple branch uses sendEmail with threadId; coordinator keeps raw Resend", () => {
    assert.match(src, /if \(role === "couple"\)/);
    assert.match(src, /resolveVenueCoupleThreadId/);
    assert.match(src, /threadId: threadId \?\? undefined/);
    assert.match(src, /buildTourReminderCoordinatorEmail/);
    // Coordinator path still uses direct Resend fetch (branding preserved).
    assert.match(src, /fetch\("https:\/\/api\.resend\.com\/emails"/);
  });
});

describe("protected proposal and contract threading remain intact", () => {
  it("proposal and contract still pass threadId", () => {
    const proposal = readFileSync(resolve("lib/commercial-proposals/couple-email.ts"), "utf8");
    const contract = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
    assert.match(proposal, /threadId: conversationId \?\? undefined/);
    assert.match(contract, /threadId: conversationId \?\? undefined/);
  });
});
