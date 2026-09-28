/**
 * Payment-request send-once: persisted conversation outbound, not in-flight lock only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  beginOutboundSend,
  DOCUMENT_COPY_SOURCE_TYPE,
  endOutboundSend,
  PAYMENT_REQUEST_SOURCE_TYPE,
} from "@/lib/invoices/outbound";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("payment request send-once (persisted)", () => {
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
    // Must not treat draft→sent publication as payment-request sent.
    assert.doesNotMatch(
      outbound.slice(outbound.indexOf("hasSuccessfulPaymentRequestSend")),
      /invoice\.status === ["']sent["']/,
    );
  });

  it("send rejects a second sequential payment request after success", () => {
    const send = actions.slice(
      actions.indexOf("export async function sendInvoiceEmailAction"),
      actions.indexOf("export async function previewInvoiceDocumentCopyAction"),
    );
    assert.match(send, /hasSuccessfulPaymentRequestSend/);
    assert.match(send, /PAYMENT_REQUEST_ALREADY_SENT/);
    assert.match(actions, /already sent/i);
    assert.match(send, /sourceType: PAYMENT_REQUEST_SOURCE_TYPE/);
    // In-flight lock remains for concurrency; persisted check is also required.
    assert.match(send, /beginOutboundSend\("payment_request"/);
  });

  it("preview / page load expose already-sent so reload keeps protection", () => {
    assert.match(actions, /hasSuccessfulPaymentRequestSend/);
    assert.match(actions, /previewPaymentRequestAction/);
    assert.match(actions, /PAYMENT_REQUEST_ALREADY_SENT/);
    assert.match(actions, /already sent/i);
    assert.match(page, /paymentRequestAlreadySent/);
    assert.match(page, /hasSuccessfulPaymentRequestSend/);
    assert.match(detail, /paymentRequestAlreadySent/);
    assert.match(detail, /payment-request-already-sent/);
    assert.match(detail, /setPaymentRequestSent\(true\)/);
  });

  it("failed send does not invent a permanent sent mark before Resend success", () => {
    const send = actions.slice(
      actions.indexOf("export async function sendInvoiceEmailAction"),
      actions.indexOf("export async function previewInvoiceDocumentCopyAction"),
    );
    // Record only after Resend success — same as before.
    assert.match(send, /result\.ok && result\.method === "resend"/);
    assert.match(send, /recordExternalClientOutbound/);
    // No optimistic write before sendEmail.
    const recordAt = send.indexOf("recordExternalClientOutbound");
    const sendAt = send.indexOf("sendEmail(");
    assert.ok(sendAt > 0 && recordAt > sendAt);
  });

  it("document copy stays independently resendable", () => {
    const doc = actions.slice(actions.indexOf("export async function sendInvoiceDocumentCopyAction"));
    assert.match(doc, /sourceType: DOCUMENT_COPY_SOURCE_TYPE/);
    assert.equal(DOCUMENT_COPY_SOURCE_TYPE, "invoice_document_copy");
    assert.equal(PAYMENT_REQUEST_SOURCE_TYPE, "invoice_email");
    assert.notEqual(DOCUMENT_COPY_SOURCE_TYPE, PAYMENT_REQUEST_SOURCE_TYPE);
    assert.doesNotMatch(doc, /hasSuccessfulPaymentRequestSend/);
    assert.match(detail, /Send copy of payment plan and invoice/);
    // Document copy button is not gated by paymentRequestSent.
    const docBtn = detail.slice(
      detail.indexOf("Send copy of payment plan and invoice") - 200,
      detail.indexOf("Send copy of payment plan and invoice") + 80,
    );
    assert.doesNotMatch(docBtn, /paymentRequestSent/);
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
