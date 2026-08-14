/**
 * Starter Packages — unit tests (node:test).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PACKAGE_STARTER_MASTERS,
  getPackageStarterMaster,
  shouldSkipPackageStarterProvision,
} from "@/lib/packages/starters";

const MONEY_PATTERNS = [
  /\$\s*\d/,
  /\d[\d,]*\.\d{2}/,
  /\b\d{3,}\b.*(?:price|cost|fee|deposit|spend)/i,
  /(?:price|cost|fee|deposit|spend).*\b\d{3,}\b/i,
];

describe("Starter Package masters", () => {
  it("ships PKG-01 / PKG-02 / PKG-03 with customer-facing Essential / Signature / Full-Service names", () => {
    assert.equal(PACKAGE_STARTER_MASTERS.length, 3);
    assert.equal(getPackageStarterMaster("PKG-01")!.name, "Essential Wedding");
    assert.equal(getPackageStarterMaster("PKG-02")!.name, "Signature Wedding");
    assert.equal(getPackageStarterMaster("PKG-03")!.name, "Full-Service Wedding");
  });

  it("uses exact product descriptions (Hello to Cheers customize language)", () => {
    assert.match(getPackageStarterMaster("PKG-01")!.description, /Customize the included spaces/);
    assert.match(getPackageStarterMaster("PKG-02")!.description, /Customize the included services/);
    assert.match(getPackageStarterMaster("PKG-03")!.description, /match what your venue actually provides/);
  });

  it("does not seed any prices on masters (price field does not exist)", () => {
    for (const master of PACKAGE_STARTER_MASTERS) {
      assert.equal("basePrice" in master, false);
      assert.equal("price" in master, false);
      const blob = `${master.name}\n${master.description}\n${master.items.map((i) => i.description).join("\n")}`;
      for (const pat of MONEY_PATTERNS) {
        assert.doesNotMatch(blob, pat, `${master.key} contains price-like text`);
      }
    }
  });

  it("differentiates tiers by inclusion count and unique Full-Service / Signature touchpoints", () => {
    const essential = getPackageStarterMaster("PKG-01")!;
    const signature = getPackageStarterMaster("PKG-02")!;
    const full = getPackageStarterMaster("PKG-03")!;

    assert.ok(essential.items.length < signature.items.length);
    assert.ok(signature.items.length < full.items.length);

    const eDesc = new Set(essential.items.map((i) => i.description));
    const sDesc = new Set(signature.items.map((i) => i.description));
    const fDesc = new Set(full.items.map((i) => i.description));

    assert.ok([...sDesc].some((d) => !eDesc.has(d)), "Signature must add beyond Essential");
    assert.ok([...fDesc].some((d) => !sDesc.has(d)), "Full-Service must add beyond Signature");

    assert.ok([...fDesc].some((d) => /load-in|load-out/i.test(d)));
    assert.ok([...fDesc].some((d) => /place-setting/i.test(d)));
    assert.ok([...sDesc].some((d) => /linens/i.test(d)));
    assert.equal([...eDesc].some((d) => /linens/i.test(d)), false);
  });

  it("avoids catering, alcohol, capacity, and legal policy claims", () => {
    const banned = [
      /\bcater/i,
      /\balcohol\b/i,
      /\bbar service\b/i,
      /\b\d+\s*guests?\b/i,
      /\bliabilit/i,
      /\bindemnif/i,
      /\bgratuity\b/i,
      /\bminimum spend\b/i,
    ];
    for (const master of PACKAGE_STARTER_MASTERS) {
      const blob = `${master.description}\n${master.items.map((i) => i.description).join("\n")}`;
      for (const pat of banned) {
        assert.doesNotMatch(blob, pat, `${master.key}`);
      }
    }
  });
});

describe("Package starter provision skip rules", () => {
  it("skips when source_master_key already exists (idempotent)", () => {
    assert.equal(
      shouldSkipPackageStarterProvision({
        masterKey: "PKG-01",
        masterName: "Essential Wedding",
        existingByKey: new Set(["PKG-01"]),
        existingNames: new Set(),
      }),
      "skip_key",
    );
  });

  it("skips same-named customized packages (never overwrite)", () => {
    assert.equal(
      shouldSkipPackageStarterProvision({
        masterKey: "PKG-01",
        masterName: "Essential Wedding",
        existingByKey: new Set(),
        existingNames: new Set(["Essential Wedding"]),
      }),
      "skip_name",
    );
  });

  it("creates when key and name are free", () => {
    assert.equal(
      shouldSkipPackageStarterProvision({
        masterKey: "PKG-02",
        masterName: "Signature Wedding",
        existingByKey: new Set(["PKG-01"]),
        existingNames: new Set(["Essential Wedding"]),
      }),
      "create",
    );
  });
});
