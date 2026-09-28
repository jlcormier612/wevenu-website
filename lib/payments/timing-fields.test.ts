import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { parseDaysInput } from "@/lib/payments/parse-days-input";

describe("parseDaysInput", () => {
  it("keeps an empty Days field as explicit editing, not 0", () => {
    assert.deepEqual(parseDaysInput(""), { editing: true, days: null });
    assert.deepEqual(parseDaysInput("   "), { editing: true, days: null });
  });

  it("commits a typed day count", () => {
    assert.deepEqual(parseDaysInput("60"), { editing: true, days: 60 });
    assert.deepEqual(parseDaysInput("0"), { editing: true, days: 0 });
  });
});

describe("Days input editing does not collapse to on_event", () => {
  const shared = readFileSync("components/payments/timing-fields.tsx", "utf8");
  const builder = readFileSync("components/payments/payment-plan-builder.tsx", "utf8");
  const form = readFileSync("components/payments/new-schedule-form.tsx", "utf8");

  it("uses explicit editing state instead of Number empty or 0", () => {
    assert.match(shared, /daysDraft/);
    assert.doesNotMatch(shared, /Number\([^)]*\) \|\| 0/);
    assert.match(builder, /from "@\/components\/payments\/timing-fields"/);
    assert.match(form, /from "@\/components\/payments\/timing-fields"/);
    assert.doesNotMatch(shared, /Number\(e\.target\.value\) \|\| 0/);
  });

  it("does not remap before_event days=0 to on_event while editing", () => {
    assert.doesNotMatch(
      shared,
      /before_event && line\.timing\.days === 0/,
    );
  });
});
