import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  contractListPrimaryTitle,
  contractListSecondaryLabel,
  contractListUsesClientPrimary,
} from "@/lib/contracts/list-identity";

describe("Contracts list identity / nomenclature", () => {
  it("primary list identity is client/customer name when present", () => {
    assert.equal(
      contractListPrimaryTitle({
        clientName: "Jane Smith & John Doe",
        title: "Venue Rental Agreement — Jane Smith & John Doe",
      }),
      "Jane Smith & John Doe",
    );
    assert.equal(
      contractListPrimaryTitle({
        clientName: "Rory Gilmore & Jess Mariano",
        title: "Venue Rental Agreement — Rory Gilmore & Jess Mariano",
      }),
      "Rory Gilmore & Jess Mariano",
    );
  });

  it("does not use document/template title as primary when client name exists", () => {
    assert.notEqual(
      contractListPrimaryTitle({
        clientName: "Jane Smith & John Doe",
        title: "AES Jane Additional Preview 1790903217850",
      }),
      "AES Jane Additional Preview 1790903217850",
    );
    assert.equal(
      contractListPrimaryTitle({
        clientName: "Jane Smith & John Doe",
        title: "Sign first-name UX proof 1790902950958",
      }),
      "Jane Smith & John Doe",
    );
  });

  it("secondary label prefers template name as authoritative type", () => {
    assert.equal(
      contractListSecondaryLabel({
        title: "Venue Rental Agreement — Jane Smith & John Doe",
        clientName: "Jane Smith & John Doe",
        templateName: "Wedding Venue Agreement",
      }),
      "Wedding Venue Agreement",
    );
  });

  it("secondary falls back to title prefix before em-dash", () => {
    assert.equal(
      contractListSecondaryLabel({
        title: "Venue Rental Agreement — Jane Smith & John Doe",
        clientName: "Jane Smith & John Doe",
      }),
      "Venue Rental Agreement",
    );
  });

  it("test/document titles are not used as type when client is known", () => {
    assert.equal(
      contractListSecondaryLabel({
        title: "AES Jane Additional Preview 1790903217850",
        clientName: "Jane Smith & John Doe",
      }),
      "Contract",
    );
  });

  it("supported naming cases resolve correctly", () => {
    assert.equal(
      contractListPrimaryTitle({
        clientName: "Miss Piggy & Kermit Frog",
        title: "Venue Rental Agreement — Miss Piggy & Kermit Frog",
      }),
      "Miss Piggy & Kermit Frog",
    );
    assert.equal(
      contractListPrimaryTitle({
        clientName: "SelUse Proof5492",
        title: "Venue Rental Agreement — SelUse Proof5492",
      }),
      "SelUse Proof5492",
    );
    assert.equal(
      contractListPrimaryTitle({
        clientName: "Acme Corporation",
        title: "Corporate Event Contract — Acme Corporation",
      }),
      "Acme Corporation",
    );
    assert.equal(
      contractListSecondaryLabel({
        title: "Corporate Event Contract — Acme Corporation",
        clientName: "Acme Corporation",
      }),
      "Corporate Event Contract",
    );
  });

  it("falls back to title when client name missing", () => {
    assert.equal(
      contractListPrimaryTitle({
        clientName: null,
        title: "Orphan draft agreement",
      }),
      "Orphan draft agreement",
    );
    assert.equal(contractListUsesClientPrimary({ clientName: null }), false);
    assert.equal(contractListUsesClientPrimary({ clientName: "Ada" }), true);
  });

  it("list component uses identity helpers and keeps contract href", () => {
    const src = readFileSync(resolve("components/contracts/contract-list.tsx"), "utf8");
    assert.match(src, /contractListPrimaryTitle/);
    assert.match(src, /contractListSecondaryLabel/);
    assert.match(src, /\/contracts\/\$\{contract\.id\}/);
    assert.doesNotMatch(src, />\{contract\.title\}</);
  });
});
