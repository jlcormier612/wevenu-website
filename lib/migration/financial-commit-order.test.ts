import assert from "node:assert/strict";
import test from "node:test";
import { financialCommitOrder } from "./financial-import";

test("a refund later in the file commits after its payment, whatever the record id", () => {
  const payment = { sourceRowRef: "row 3", normalizedPayload: { recordKind: "movement" } };
  const refund = { sourceRowRef: "row 4", normalizedPayload: { recordKind: "movement" } };
  const invoice = { sourceRowRef: "row 9", normalizedPayload: { recordKind: "invoice" } };
  const ordered = [refund, invoice, payment].slice().sort((a, b) => {
    const [aKind, aRow] = financialCommitOrder(a);
    const [bKind, bRow] = financialCommitOrder(b);
    return aKind - bKind || aRow - bRow;
  });
  assert.deepEqual(ordered.map((row) => row.sourceRowRef), ["row 9", "row 3", "row 4"]);
});
