import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Select package deposit autofill", () => {
  it("package row click uses choosePackage so deposit autofills", () => {
    const src = readFileSync(resolve("components/booking-journey/select-package-sheet.tsx"), "utf8");
    assert.match(src, /function choosePackage\(id: string\)/);
    assert.match(src, /suggestDepositAmount/);
    assert.match(src, /onClick=\{\(\) => choosePackage\(pkg\.id\)\}/);
    assert.doesNotMatch(src, /onClick=\{\(\) => setPackageId\(pkg\.id\)\}/);
  });
});
