import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appendContractReturnTo,
  resolveContractBackNavigation,
  safeContractReturnPath,
} from "@/lib/contracts/return-path";

describe("safeContractReturnPath", () => {
  it("allows lead, client, contracts, and documents origins", () => {
    assert.equal(
      safeContractReturnPath("/leads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"),
      "/leads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    );
    assert.equal(
      safeContractReturnPath("/clients/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"),
      "/clients/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    );
    assert.equal(safeContractReturnPath("/contracts"), "/contracts");
    assert.equal(safeContractReturnPath("/documents"), "/documents");
    assert.equal(
      safeContractReturnPath("/clients/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee#documents"),
      "/clients/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee#documents",
    );
  });

  it("rejects open redirects and unrelated paths", () => {
    assert.equal(safeContractReturnPath("https://evil.example/phish"), null);
    assert.equal(safeContractReturnPath("//evil.example"), null);
    assert.equal(safeContractReturnPath("/settings"), null);
    assert.equal(safeContractReturnPath("/contracts/templates/x"), null);
    assert.equal(safeContractReturnPath("../leads/x"), null);
    assert.equal(safeContractReturnPath(null), null);
  });

  it("does not infer relationships from display text", () => {
    assert.equal(safeContractReturnPath("Lucy Peanut & Charlie Brown"), null);
    assert.equal(safeContractReturnPath("/leads/Lucy Peanut"), null);
  });
});

describe("resolveContractBackNavigation", () => {
  it("Lead Documents origin returns to the lead overview", () => {
    const nav = resolveContractBackNavigation({
      returnTo: "/leads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      clientId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      clientName: "Lucy Peanut & Charlie Brown",
    });
    assert.equal(nav.href, "/leads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    assert.equal(nav.label, "Lucy Peanut & Charlie Brown");
  });

  it("Client Workspace origin returns to Client Workspace", () => {
    const nav = resolveContractBackNavigation({
      returnTo: "/clients/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      clientId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      clientName: "Lucy Peanut & Charlie Brown",
    });
    assert.equal(nav.href, "/clients/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    assert.equal(nav.label, "Lucy Peanut & Charlie Brown");
  });

  it("Global Contracts origin returns to Contracts", () => {
    const nav = resolveContractBackNavigation({
      returnTo: "/contracts",
      clientId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      clientName: "Someone",
    });
    assert.equal(nav.href, "/contracts");
    assert.equal(nav.label, "Contracts");
  });

  it("no-context fallback uses client when present, else Contracts", () => {
    assert.deepEqual(
      resolveContractBackNavigation({
        clientId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        clientName: "Couple",
      }),
      { href: "/clients/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee", label: "Couple" },
    );
    assert.deepEqual(
      resolveContractBackNavigation({ clientId: null, clientName: null }),
      { href: "/contracts", label: "Contracts" },
    );
  });

  it("ignores unsafe returnTo and falls back", () => {
    const nav = resolveContractBackNavigation({
      returnTo: "https://evil.example",
      clientId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      clientName: "A",
    });
    assert.equal(nav.href, "/clients/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  });
});

describe("appendContractReturnTo", () => {
  it("appends only to contract producer hrefs", () => {
    assert.equal(
      appendContractReturnTo(
        "/contracts/c1",
        "/leads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      ),
      "/contracts/c1?returnTo=%2Fleads%2Faaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    );
    assert.equal(
      appendContractReturnTo("/invoices/i1", "/leads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"),
      "/invoices/i1",
    );
    assert.equal(appendContractReturnTo("/contracts/c1", "https://evil"), "/contracts/c1");
  });
});
