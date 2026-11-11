import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  paymentScheduleListPrimaryTitle,
  paymentScheduleListSecondaryLine,
} from "@/lib/payments/list-identity";

describe("Payments list identity / scanability", () => {
  it("primary title is client/couple name when present", () => {
    assert.equal(
      paymentScheduleListPrimaryTitle({
        clientName: "Miss Piggy & Kermit Frog",
        title: "Essential Wedding payments",
      }),
      "Miss Piggy & Kermit Frog",
    );
  });

  it("falls back to schedule title when client name missing", () => {
    assert.equal(
      paymentScheduleListPrimaryTitle({
        clientName: null,
        title: "Essential Wedding payments",
      }),
      "Essential Wedding payments",
    );
  });

  it("secondary line keeps payment-plan name and overdue count", () => {
    assert.equal(
      paymentScheduleListSecondaryLine({
        title: "Essential Wedding payments",
        overdueCount: 1,
      }),
      "Essential Wedding · 1 overdue payment",
    );
    assert.equal(
      paymentScheduleListSecondaryLine({
        title: "Signature Wedding payments",
        overdueCount: 2,
      }),
      "Signature Wedding · 2 overdue payments",
    );
    assert.equal(
      paymentScheduleListSecondaryLine({
        title: "Garden Package payments",
        overdueCount: 0,
      }),
      "Garden Package",
    );
  });

  it("single-client names resolve without inventing a partner", () => {
    assert.equal(
      paymentScheduleListPrimaryTitle({
        clientName: "SelUse Proof5492",
        title: "Essential Wedding payments",
      }),
      "SelUse Proof5492",
    );
  });
});
