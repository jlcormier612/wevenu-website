/**
 * Payment-request send-once: persisted conversation outbound, not in-flight lock only.
 * Canonical send is sendInvoiceAndPaymentPlanAction; it records sourceType invoice_email.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  beginOutboundSend,
  endOutboundSend,
  PAYMENT_REQUEST_SOURCE_TYPE,
} from "@/lib/invoices/outbound";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("invoice and payment plan send-once (persisted)", () => {
  const actions = read("app/(app)/invoices/actions.ts");
  const outbound = read("lib/invoices/outbound.ts");
  const detail = read("components/invoices/invoice-detail.tsx");
  const page = read("app/(app)/invoices/[id]/page.tsx");

  it("authoritative signal is conversation invoice_email, not invoice.status alone", () => {
    assert.match(outbound, /hasSuccessfulPaymentRequestSend/);
    assert.match(outbound, /PAYMENT_REQUEST_SOURCE_TYPE = "invoice_email"/);
    assert.match(outbound, /contains\("channel_metadata"/);
    assert.match(outbound, /sourceType: PAYMENT_REQUEST_SOURCE_TYPE/);
    assert.match(outbound, /sourceId: opts\.invoiceId/);
    assert.match(outbound, /status", "accepted"/);
    assert.doesNotMatch(
      outbound.slice(outbound.indexOf("hasSuccessfulPaymentRequestSend")),
      /invoice\.status === ["']sent["']/,
    );
  });

  it("send rejects a second sequential send after success", () => {
    const send = actions.slice(
      actions.indexOf("export async function sendInvoiceAndPaymentPlanAction"),
      actions.indexOf("export async function sendInvoiceEmailAction"),
    );
    assert.match(send, /hasSuccessfulPaymentRequestSend/);
    assert.match(send, /INVOICE_ALREADY_SENT/);
    assert.match(actions, /already sent/i);
    assert.match(send, /sourceType: PAYMENT_REQUEST_SOURCE_TYPE/);
    assert.match(send, /beginOutboundSend\("payment_request"/);
    assert.equal(PAYMENT_REQUEST_SOURCE_TYPE, "invoice_email");
  });

  it("preview / page load expose already-sent so reload keeps protection", () => {
    assert.match(actions, /hasSuccessfulPaymentRequestSend/);
    assert.match(actions, /previewInvoiceAndPaymentPlanAction/);
    assert.match(actions, /INVOICE_ALREADY_SENT/);
    assert.match(page, /paymentRequestAlreadySent/);
    assert.match(page, /hasSuccessfulPaymentRequestSend/);
    assert.match(detail, /paymentRequestAlreadySent/);
    assert.match(detail, /payment-request-already-sent/);
    assert.match(detail, /setPaymentRequestSent\(true\)/);
  });

  it("failed send does not invent a permanent sent mark before Resend success", () => {
    const send = actions.slice(
      actions.indexOf("export async function sendInvoiceAndPaymentPlanAction"),
      actions.indexOf("export async function sendInvoiceEmailAction"),
    );
    assert.match(send, /result\.ok && result\.method === "resend"/);
    assert.match(send, /recordExternalClientOutbound/);
    const recordAt = send.indexOf("recordExternalClientOutbound");
    const sendAt = send.indexOf("sendEmail(");
    assert.ok(sendAt > 0 && recordAt > sendAt);
  });

  it("legacy send aliases share the same send-once gate", () => {
    assert.match(actions, /export async function sendInvoiceEmailAction/);
    assert.match(actions, /return sendInvoiceAndPaymentPlanAction/);
    assert.match(actions, /export async function sendInvoiceDocumentCopyAction/);
  });

  it("in-flight lock still blocks concurrent duplicates; end clears for retry after failure path", () => {
    const id = `once-${Date.now()}`;
    assert.equal(beginOutboundSend("payment_request", id), true);
    assert.equal(beginOutboundSend("payment_request", id), false);
    endOutboundSend("payment_request", id);
    assert.equal(beginOutboundSend("payment_request", id), true);
    endOutboundSend("payment_request", id);
  });
});
