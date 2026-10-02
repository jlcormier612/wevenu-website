import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { greetingFirstName } from "@shared/relationships/normalize";
import {
  BOOKING_JOURNEY_PAYMENTS_HASH,
  resolveContractBackNavigation,
  resolveContractSetupPaymentsHref,
  safeContractReturnPath,
  appendContractReturnTo,
} from "@/lib/contracts/return-path";

describe("signing confirmation uses greetingFirstName", () => {
  it("derives first name from full legal name for the thank-you line", () => {
    assert.equal(greetingFirstName({ fullName: "Kermit Frog" }), "Kermit");
    assert.equal(greetingFirstName({ fullName: "Mary Jane Watson" }), "Mary");
  });

  it("SignForm greets with greetingFirstName and still submits the full name", () => {
    const src = readFileSync(resolve("app/sign/[token]/sign-form.tsx"), "utf8");
    assert.match(src, /greetingFirstName/);
    assert.match(src, /Thank you, \{thankYouName\}/);
    assert.match(src, /signContractAction\(token, name, consent\)/);
    assert.doesNotMatch(src, /Thank you, \{name\}\./);
  });
});

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

describe("resolveContractSetupPaymentsHref — Fully Executed ≠ Booked", () => {
  const leadId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const clientId = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";

  it("pre-booking from lead returnTo → lead overview payment section", () => {
    assert.equal(
      resolveContractSetupPaymentsHref({
        returnTo: `/leads/${leadId}`,
        leadId,
        clientId,
        relationshipBooked: false,
      }),
      `/leads/${leadId}?setupPayments=1#${BOOKING_JOURNEY_PAYMENTS_HASH}`,
    );
  });

  it("pre-booking with leadId and no returnTo → lead overview payment section", () => {
    assert.equal(
      resolveContractSetupPaymentsHref({
        leadId,
        clientId,
        relationshipBooked: false,
      }),
      `/leads/${leadId}?setupPayments=1#${BOOKING_JOURNEY_PAYMENTS_HASH}`,
    );
  });

  it("does not send pre-booking setup to the client workspace", () => {
    const href = resolveContractSetupPaymentsHref({
      leadId,
      clientId,
      relationshipBooked: false,
    });
    assert.ok(href);
    assert.doesNotMatch(href!, /\/clients\//);
  });

  it("booked relationship → client workspace setupPayments", () => {
    assert.equal(
      resolveContractSetupPaymentsHref({
        returnTo: `/leads/${leadId}`,
        leadId,
        clientId,
        relationshipBooked: true,
      }),
      `/clients/${clientId}?setupPayments=1`,
    );
  });

  it("Contract Detail uses resolveContractSetupPaymentsHref", () => {
    const detail = readFileSync(resolve("components/contracts/contract-detail.tsx"), "utf8");
    assert.match(detail, /resolveContractSetupPaymentsHref/);
    assert.doesNotMatch(detail, /\/clients\/\$\{contract\.clientId\}\?setupPayments=1/);
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

  it("no-context fallback prefers Lead when not booked", () => {
    assert.deepEqual(
      resolveContractBackNavigation({
        clientId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        clientName: "Couple",
        leadId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        relationshipBooked: false,
      }),
      { href: "/leads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", label: "Couple" },
    );
  });

  it("no-context fallback uses client when booked or lead missing", () => {
    assert.deepEqual(
      resolveContractBackNavigation({
        clientId: "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        clientName: "Couple",
        leadId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        relationshipBooked: true,
      }),
      { href: "/clients/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee", label: "Couple" },
    );
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

describe("document workspace still preserves contract returnTo independently of invoices", () => {
  it("lead origin still resolves to the lead, not invoices", () => {
    const nav = resolveContractBackNavigation({
      returnTo: "/leads/54fb2e7d-d429-4701-afe1-ea4a39cb03b4",
      clientName: "Lucy Peanut & Charlie Brown",
    });
    assert.equal(nav.href, "/leads/54fb2e7d-d429-4701-afe1-ea4a39cb03b4");
    assert.equal(nav.label, "Lucy Peanut & Charlie Brown");
  });
});
