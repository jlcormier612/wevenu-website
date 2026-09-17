/**
 * Briefing attention deep-link destinations.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contractAttentionHref,
  paymentsAttentionHref,
  requestsAttentionHref,
} from "@/lib/luv/briefing-attention-links";

describe("briefing attention deep links", () => {
  it("opens the draft contract, not the client workspace root", () => {
    const href = contractAttentionHref(
      [
        { id: "c-signed", status: "signed" } as never,
        { id: "c-draft", status: "draft" } as never,
      ],
      "client-1",
    );
    assert.equal(href, "/contracts/c-draft");
  });

  it("opens the overdue invoice for payment attention", () => {
    const href = paymentsAttentionHref(
      [
        {
          id: "inv-ok",
          balanceDue: 0,
          dueDate: "2026-01-01",
        } as never,
        {
          id: "inv-overdue",
          balanceDue: 500,
          dueDate: "2020-01-01",
        } as never,
      ],
      "client-1",
    );
    assert.equal(href, "/invoices/inv-overdue");
  });

  it("opens the outstanding request record", () => {
    const href = requestsAttentionHref(
      [
        { id: "r-draft", status: "draft" } as never,
        { id: "r-open", status: "pending" } as never,
      ],
      "client-1",
    );
    assert.equal(href, "/requests/r-open");
  });

  it("falls back to the client tab when no specific record exists", () => {
    assert.equal(contractAttentionHref([], "client-1"), "/clients/client-1#documents");
    assert.equal(paymentsAttentionHref([], "client-1"), "/clients/client-1#invoice");
    assert.equal(requestsAttentionHref([], "client-1"), "/clients/client-1#requests-summary-card");
  });
});
