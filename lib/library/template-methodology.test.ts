import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  INCOMPLETE_TEMPLATE_WARNING_BODY,
  INCOMPLETE_TEMPLATE_WARNING_TITLE,
  isChoicesTemplateUnfinished,
  isEventOrderTemplateUnfinished,
  isInventoryTemplateUnfinished,
} from "@/lib/library/template-readiness";
import {
  filterTemplateApplyClientGroups,
  formatClientDisplayName,
  groupTemplateApplyTargets,
  isTemplateApplyEventEligible,
  type TemplateApplyEventTarget,
} from "@/lib/library/template-apply-targets";

describe("template structural readiness", () => {
  it("EO unfinished only when zero lines (sections alone do not finish)", () => {
    assert.equal(isEventOrderTemplateUnfinished(0), true);
    assert.equal(isEventOrderTemplateUnfinished(1), false);
    // Intentionally unpriced EO (lines exist) is finished structurally
    assert.equal(isEventOrderTemplateUnfinished(2), false);
  });

  it("Inventory unfinished when zero items", () => {
    assert.equal(isInventoryTemplateUnfinished(0), true);
    assert.equal(isInventoryTemplateUnfinished(3), false);
  });

  it("Choices unfinished when zero groups OR zero options", () => {
    assert.equal(isChoicesTemplateUnfinished(0, 0), true);
    assert.equal(isChoicesTemplateUnfinished(1, 0), true);
    assert.equal(isChoicesTemplateUnfinished(0, 2), true);
    assert.equal(isChoicesTemplateUnfinished(1, 2), false);
  });

  it("warning title is the locked customer-facing copy", () => {
    assert.equal(INCOMPLETE_TEMPLATE_WARNING_TITLE, "This template isn’t finished yet.");
    assert.equal(
      INCOMPLETE_TEMPLATE_WARNING_BODY,
      "You can go back and finish it, or apply it anyway.",
    );
  });

  it("IncompleteTemplateWarningDialog exposes Go Back + Apply Anyway", () => {
    const src = readFileSync(
      resolve("components/library/incomplete-template-warning-dialog.tsx"),
      "utf8",
    );
    assert.match(src, /incomplete-template-go-back/);
    assert.match(src, /incomplete-template-apply-anyway/);
    assert.match(src, /Go Back/);
    assert.match(src, /Apply Anyway/);
  });

  it("all three Use sheets gate apply through unfinished check + warning dialog", () => {
    const eo = readFileSync(resolve("components/event-order-templates/event-order-template-list.tsx"), "utf8");
    const inv = readFileSync(resolve("components/event-inventory/inventory-template-list.tsx"), "utf8");
    const ch = readFileSync(resolve("components/client-choices-templates/choices-template-list.tsx"), "utf8");
    assert.match(eo, /isEventOrderTemplateUnfinished/);
    assert.match(eo, /IncompleteTemplateWarningDialog/);
    assert.match(inv, /isInventoryTemplateUnfinished/);
    assert.match(inv, /IncompleteTemplateWarningDialog/);
    assert.match(ch, /isChoicesTemplateUnfinished/);
    assert.match(ch, /IncompleteTemplateWarningDialog/);
  });
});

describe("template apply targets — cancelled filter + client grouping", () => {
  const ron: TemplateApplyEventTarget = {
    id: "ev-ron",
    name: "Corporate Event",
    eventDate: "2026-10-24",
    status: "confirmed",
    clientId: "c-ron",
    clientDisplayName: "Ron Cormier & Jen Cormier",
  };
  const probe: TemplateApplyEventTarget = {
    id: "ev-probe",
    name: "Tour Overlap Probe",
    eventDate: "2026-11-04",
    status: "cancelled",
    clientId: "c-probe",
    clientDisplayName: "Tour Overlap Probe",
  };
  const janeA: TemplateApplyEventTarget = {
    id: "ev-jane-a",
    name: "Rehearsal",
    eventDate: "2027-06-20",
    status: "confirmed",
    clientId: "c-jane",
    clientDisplayName: "Jane Smith & John Doe",
  };
  const janeB: TemplateApplyEventTarget = {
    id: "ev-jane-b",
    name: "Wedding",
    eventDate: "2027-06-21",
    status: "draft",
    clientId: "c-jane",
    clientDisplayName: "Jane Smith & John Doe",
  };

  it("excludes cancelled events from eligibility", () => {
    assert.equal(isTemplateApplyEventEligible("cancelled"), false);
    assert.equal(isTemplateApplyEventEligible("confirmed"), true);
    assert.equal(isTemplateApplyEventEligible("draft"), true);
  });

  it("groups by client and omits cancelled probes", () => {
    const groups = groupTemplateApplyTargets([probe, ron, janeB, janeA]);
    assert.equal(groups.length, 2);
    assert.ok(!groups.some((g) => g.events.some((e) => e.status === "cancelled")));
    assert.ok(!groups.some((g) => /probe/i.test(g.clientDisplayName)));
    const ronGroup = groups.find((g) => g.clientId === "c-ron");
    assert.ok(ronGroup);
    assert.equal(ronGroup!.events[0].name, "Corporate Event");
    const jane = groups.find((g) => g.clientId === "c-jane");
    assert.equal(jane!.events.length, 2);
    assert.equal(jane!.events[0].id, "ev-jane-a");
  });

  it("search matches client or event name", () => {
    const groups = groupTemplateApplyTargets([ron, janeA]);
    assert.equal(filterTemplateApplyClientGroups(groups, "Ron").length, 1);
    assert.equal(filterTemplateApplyClientGroups(groups, "Corporate").length, 1);
    assert.equal(filterTemplateApplyClientGroups(groups, "probe").length, 0);
  });

  it("formats partner client display names", () => {
    assert.equal(
      formatClientDisplayName({
        firstName: "Ron",
        lastName: "Cormier",
        partnerFirstName: "Jen",
        partnerLastName: "Cormier",
      }),
      "Ron Cormier & Jen Cormier",
    );
  });
});
