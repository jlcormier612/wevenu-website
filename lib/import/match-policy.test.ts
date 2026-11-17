import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  classifyPersonMatch,
  countedEntityLabel,
  personImportConfirmLabel,
  resolvePersonMatchAction,
  summarizePersonImportPlan,
  type PersonMatchCandidate,
} from "@/lib/import/match-policy";

const existing: PersonMatchCandidate = {
  id: "c1",
  firstName: "Ava",
  lastName: "Chen",
  email: "office@venue.test",
};

describe("classifyPersonMatch", () => {
  it("treats name + email as an exact match so extra events do not duplicate the client", () => {
    const d = classifyPersonMatch(
      { firstName: "Ava", lastName: "Chen", email: "office@venue.test" },
      existing,
      existing,
    );
    assert.equal(d.kind, "exact");
    assert.equal(d.matchedId, "c1");
    assert.equal(d.defaultAction, "use_existing");
  });

  it("does not treat email alone as conclusive identity", () => {
    const d = classifyPersonMatch(
      { firstName: "Jordan", lastName: "Lee", email: "office@venue.test" },
      existing,
      null,
    );
    assert.equal(d.kind, "likely");
    assert.equal(d.defaultAction, "skip");
    assert.match(d.reason, /Shared addresses are not conclusive/i);
  });

  it("flags a partner who shares the household email as likely, not a silent merge", () => {
    const d = classifyPersonMatch(
      {
        firstName: "Sam",
        lastName: "Reed",
        email: "office@venue.test",
        partnerFirstName: "Ava",
        partnerLastName: "Chen",
      },
      existing,
      null,
    );
    assert.equal(d.kind, "likely");
    assert.equal(d.defaultAction, "skip");
  });

  it("treats same name with a different email as likely, not exact", () => {
    const d = classifyPersonMatch(
      { firstName: "Ava", lastName: "Chen", email: "ava.personal@test" },
      null,
      existing,
    );
    assert.equal(d.kind, "likely");
    assert.equal(d.defaultAction, "skip");
  });

  it("creates a new record when nothing matches", () => {
    const d = classifyPersonMatch(
      { firstName: "Mo", lastName: "Park", email: "mo@test" },
      null,
      null,
    );
    assert.equal(d.kind, "new");
    assert.equal(d.defaultAction, "create_new");
  });
});

describe("resolvePersonMatchAction", () => {
  it("allows Create new on a likely match and refuses Use existing when there is no match", () => {
    const likely = classifyPersonMatch(
      { firstName: "Jordan", lastName: "Lee", email: "office@venue.test" },
      existing,
      null,
    );
    assert.equal(resolvePersonMatchAction(likely, "create_new"), "create_new");
    const fresh = classifyPersonMatch(
      { firstName: "Mo", lastName: "Park", email: "mo@test" },
      null,
      null,
    );
    assert.equal(resolvePersonMatchAction(fresh, "use_existing"), "create_new");
  });
});

describe("summarizePersonImportPlan", () => {
  it("does not count use-existing as creating a new client", () => {
    const counts = summarizePersonImportPlan([
      { previewSkipped: false, kind: "new", action: "create_new" },
      { previewSkipped: false, kind: "exact", action: "use_existing" },
      { previewSkipped: false, kind: "likely", action: "skip" },
      { previewSkipped: true, kind: "new", action: "create_new" },
    ]);
    assert.equal(counts.createCount, 1);
    assert.equal(counts.useExistingCount, 1);
    assert.equal(counts.skipCount, 2);
    assert.equal(counts.attentionCount, 1);
    assert.equal(personImportConfirmLabel(counts, "Clients"), "Create 1 new client · use 1 existing · skip 2");
    assert.equal(personImportConfirmLabel({ ...counts, createCount: 2, skipCount: 1 }, "Clients"), "Create 2 new clients · use 1 existing · skip 1");
    assert.equal(personImportConfirmLabel({ createCount: 1, useExistingCount: 0, skipCount: 0, attentionCount: 0 }, "Leads"), "Create 1 new lead");
    assert.equal(personImportConfirmLabel({ createCount: 2, useExistingCount: 0, skipCount: 0, attentionCount: 0 }, "Vendors"), "Create 2 new vendors");
    assert.doesNotMatch(personImportConfirmLabel(counts, "Clients"), /Import 4/);
  });
});

describe("countedEntityLabel", () => {
  it("singularizes every supported import type", () => {
    assert.equal(countedEntityLabel(1, "Clients"), "1 client");
    assert.equal(countedEntityLabel(2, "Clients"), "2 clients");
    assert.equal(countedEntityLabel(1, "Leads"), "1 lead");
    assert.equal(countedEntityLabel(1, "Vendors"), "1 vendor");
    assert.equal(countedEntityLabel(1, "Inventory Templates"), "1 inventory template");
    assert.equal(countedEntityLabel(2, "Package Templates"), "2 package templates");
  });
});

describe("import wizard match review gating", () => {
  it("does not let Import run until person matches have been loaded", () => {
    const src = readFileSync(new URL("../../components/settings/import-wizard.tsx", import.meta.url), "utf8");
    assert.match(src, /matchReviewReady/);
    assert.match(src, /Checking whether anyone is already in Hello to Cheers/);
    assert.match(src, /disabled=\{confirmDisabled\}/);
    assert.match(src, /byb-import-plan/);
    assert.match(src, /byb-match-review/);
    assert.match(src, /Use existing keeps the person already in Hello to Cheers/);
    assert.match(src, /data-hydrated=\{pasteReady \? "true" : "false"\}/);
    assert.match(src, /disabled=\{working \|\| !pasteReady\}/);
    assert.match(src, /countedEntityLabel/);
    assert.match(src, /router\.refresh\(\)/);
  });
});
