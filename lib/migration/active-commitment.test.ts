import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  commitmentOrderLines,
  validateActiveCommitment,
  summarizeCommitmentForReview,
  HISTORICAL_PAYMENT_PROVENANCE,
  type NormalizedActiveCommitment,
} from "@/lib/migration/active-commitment";
import { activeCommitmentProposalToSourceRow } from "@/lib/migration/proposal-to-row";
import { genericCsvAdapter } from "@/lib/migration/sources/generic-csv";

const smithWedding: NormalizedActiveCommitment = {
  clientEmail: "smith@example.com",
  eventDate: "2026-10-17",
  contractedTotal: "18500",
  packageName: "Full Service Wedding",
  scheduleLines: [
    {
      label: "Deposit",
      amount: "5000",
      dueDate: "2026-06-01",
      obligationKind: "deposit",
      alreadyPaid: true,
      paidDate: "2026-06-01",
      paymentMethod: "other",
    },
    {
      label: "Second payment",
      amount: "5000",
      dueDate: "2026-09-15",
      obligationKind: "installment",
      alreadyPaid: false,
    },
    {
      label: "Final payment",
      amount: "8500",
      dueDate: "2026-10-01",
      obligationKind: "final",
      alreadyPaid: false,
    },
  ],
  contractTitle: "Smith Wedding Agreement",
  contractSignedAt: "2026-05-20",
};

describe("active commitment validation", () => {
  it("accepts the Smith Wedding shape where schedule and package equal contracted total", () => {
    assert.equal(validateActiveCommitment(smithWedding), null);
    const lines = commitmentOrderLines(smithWedding);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].description, "Full Service Wedding");
  });

  it("rejects when schedule lines do not equal contracted total", () => {
    const bad = {
      ...smithWedding,
      scheduleLines: smithWedding.scheduleLines.slice(0, 2),
    };
    assert.match(validateActiveCommitment(bad) ?? "", /must equal the contracted total/i);
  });

  it("keeps historical payment provenance copy explicit", () => {
    assert.match(HISTORICAL_PAYMENT_PROVENANCE, /outside Hello to Cheers/i);
    assert.match(HISTORICAL_PAYMENT_PROVENANCE, /not processed/i);
  });

  it("summarizes paid vs remaining for the review UI", () => {
    const summary = summarizeCommitmentForReview(smithWedding);
    assert.equal(summary.contractedTotal, 18500);
    assert.equal(summary.paid, 5000);
    assert.equal(summary.remaining, 13500);
    assert.equal(summary.executionOrigin, "external");
  });
});

describe("active commitment CSV + Smart Import row bridge", () => {
  it("normalizes a flat CSV row into an active commitment", () => {
    const result = genericCsvAdapter.normalizeRow(
      {
        clientEmail: "smith@example.com",
        eventDate: "2026-10-17",
        contractedTotal: "18500",
        packageName: "Full Service Wedding",
        paidAmount: "5000",
        paidDate: "2026-06-01",
        remainingAmount1: "5000",
        remainingDueDate1: "2026-09-15",
        remainingAmount2: "8500",
        remainingDueDate2: "2026-10-01",
        contractTitle: "Smith Wedding Agreement",
      },
      "active_commitment",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.contractedTotal, "18500");
      assert.equal((result.normalized.scheduleLines as unknown[]).length, 3);
    }
  });

  it("round-trips a Smart Import proposal through the CSV adapter", () => {
    const row = activeCommitmentProposalToSourceRow(smithWedding);
    const result = genericCsvAdapter.normalizeRow(row, "active_commitment");
    assert.equal(result.ok, true);
  });

  it("imports documents as real HTC document rows when storage fields are present", () => {
    const result = genericCsvAdapter.normalizeRow(
      {
        name: "Signed agreement",
        fileName: "smith-signed.pdf",
        storagePath: "venue/x/smith-signed.pdf",
        storageUrl: "https://example.test/smith-signed.pdf",
        category: "contract",
        clientEmail: "smith@example.com",
        eventDate: "2026-10-17",
      },
      "document",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.normalized.category, "contract");
      assert.equal(result.normalized.fileName, "smith-signed.pdf");
    }
  });

  it("still refuses orphan payment-only rows", () => {
    const result = genericCsvAdapter.normalizeRow({ amount: "5000" }, "payment");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /Active commitment/i);
  });
});
