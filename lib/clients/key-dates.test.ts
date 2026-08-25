/**
 * Key Dates — focused coverage for validation + delete rows-affected guard.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateKeyDateInput } from "@/lib/clients/validation";
import { deleteKeyDate } from "@/lib/clients/repository";

describe("validateKeyDateInput", () => {
  it("rejects empty label", () => {
    const errors = validateKeyDateInput({ label: "", date: "2026-09-01", note: "" });
    assert.equal(errors.label, "A label is required.");
    assert.equal(errors.date, undefined);
  });

  it("rejects whitespace-only label", () => {
    const errors = validateKeyDateInput({ label: "   ", date: "2026-09-01", note: "" });
    assert.equal(errors.label, "A label is required.");
  });

  it("rejects missing date", () => {
    const errors = validateKeyDateInput({ label: "Final Guest Count Due", date: "", note: "" });
    assert.equal(errors.date, "A date is required.");
    assert.equal(errors.label, undefined);
  });

  it("accepts valid label + date", () => {
    const errors = validateKeyDateInput({
      label: "Final Guest Count Due",
      date: "2026-09-01",
      note: "optional",
    });
    assert.deepEqual(errors, {});
  });

  it("blocks a Rehearsal Dinner key date that disagrees with the client's structured Rehearsal Date", () => {
    const errors = validateKeyDateInput(
      { label: "Rehearsal Dinner", date: "2026-09-01", note: "" },
      "2026-08-30",
    );
    assert.match(errors.date ?? "", /already set to 2026-08-30/);
  });

  it("allows a Rehearsal Dinner key date that agrees with the client's structured Rehearsal Date", () => {
    const errors = validateKeyDateInput(
      { label: "Rehearsal Dinner", date: "2026-08-30", note: "" },
      "2026-08-30",
    );
    assert.deepEqual(errors, {});
  });

  it("allows a Rehearsal Dinner key date when the client has no structured Rehearsal Date set", () => {
    const errors = validateKeyDateInput(
      { label: "Rehearsal Dinner", date: "2026-09-01", note: "" },
      null,
    );
    assert.deepEqual(errors, {});
  });

  it("does not flag unrelated labels even when they disagree with the Rehearsal Date", () => {
    const errors = validateKeyDateInput(
      { label: "Final Guest Count Due", date: "2026-09-01", note: "" },
      "2026-08-30",
    );
    assert.deepEqual(errors, {});
  });
});

describe("deleteKeyDate rows-affected", () => {
  function mockClient(deletedIds: string[] | null, error: unknown = null) {
    const chain = {
      delete: () => chain,
      eq: () => chain,
      select: async () => ({ data: deletedIds, error }),
    };
    return { from: () => chain } as never;
  }

  it("returns ok:true when a row was deleted", async () => {
    const outcome = await deleteKeyDate(mockClient(["kd-1"]), "venue-1", "kd-1");
    assert.deepEqual(outcome, { ok: true });
  });

  it("returns ok:false when nothing was deleted (nonexistent / RLS gate)", async () => {
    const outcome = await deleteKeyDate(mockClient([]), "venue-1", "missing-id");
    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.match(outcome.message, /Owner or Manager|delete/i);
    }
  });

  it("returns ok:false when select returns null data", async () => {
    const outcome = await deleteKeyDate(mockClient(null), "venue-1", "kd-1");
    assert.equal(outcome.ok, false);
  });

  it("throws when supabase returns an error", async () => {
    await assert.rejects(
      () => deleteKeyDate(mockClient(null, { message: "db down" }), "venue-1", "kd-1"),
      (err: Error) => {
        assert.match(String(err.message ?? err), /db down/);
        return true;
      },
    );
  });
});
