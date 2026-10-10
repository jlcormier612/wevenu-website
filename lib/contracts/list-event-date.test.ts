import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveContractListEventDate } from "@/lib/contracts/list-event-date";
import { formatContractDate } from "@/lib/contracts/constants";

describe("resolveContractListEventDate", () => {
  it("prefers the linked event date over the client date", () => {
    assert.equal(
      resolveContractListEventDate("2027-12-04", "2027-09-04"),
      "2027-12-04",
    );
  });

  it("falls back to the client event date when event_id / events join is null", () => {
    assert.equal(resolveContractListEventDate(null, "2027-06-12"), "2027-06-12");
    assert.equal(resolveContractListEventDate(undefined, "2027-05-09"), "2027-05-09");
  });

  it("Lulu Lodge reported couples resolve their authoritative client dates", () => {
    // Forensic: signed Wedding Venue Agreements with event_id NULL; each
    // client.event_date matches their sole events.event_date.
    const cases = [
      { couple: "Lydia Cormier & Ali Shazam", date: "2027-06-12" },
      { couple: "Nicole Bethune & Colby Yagnesak", date: "2027-05-09" },
      { couple: "Ellie Yagnesak & Hunter Lomberto", date: "2027-10-10" },
    ];
    for (const c of cases) {
      const resolved = resolveContractListEventDate(null, c.date);
      assert.equal(resolved, c.date, c.couple);
      assert.ok(formatContractDate(resolved!), `${c.couple} formats`);
    }
  });

  it("returns null when neither event nor client has a date (empty-state dash)", () => {
    assert.equal(resolveContractListEventDate(null, null), null);
    assert.equal(resolveContractListEventDate("", "  "), null);
    assert.equal(resolveContractListEventDate(undefined, undefined), null);
  });

  it("does not invent a date when only whitespace is present", () => {
    assert.equal(resolveContractListEventDate("   ", null), null);
  });

  it("never picks a second client's event when the contract is event-linked", () => {
    // Multi-event client scenario: contract points at event A; client.event_date
    // may differ (or reflect another celebration). Linked event wins.
    assert.equal(
      resolveContractListEventDate("2028-01-01", "2027-05-09"),
      "2028-01-01",
    );
  });
});

describe("contracts repository list mapping source", () => {
  it("mapContract uses resolveContractListEventDate over events-only", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const repo = fs.readFileSync(
      path.join(process.cwd(), "lib/contracts/repository.ts"),
      "utf8",
    );
    assert.match(repo, /resolveContractListEventDate/);
    assert.match(repo, /clients\([^)]*event_date/);
    assert.match(
      repo,
      /eventDate:\s*resolveContractListEventDate\(r\.events\?\.event_date,\s*r\.clients\?\.event_date\)/,
    );
  });

  it("list filters and status badges are unchanged by the event-date helper", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const filters = fs.readFileSync(
      path.join(process.cwd(), "lib/contracts/list-filters.ts"),
      "utf8",
    );
    assert.doesNotMatch(filters, /resolveContractListEventDate/);
    assert.match(filters, /CONTRACT_LIST_FILTERS/);
  });
});
