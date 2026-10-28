/**
 * Product-wide guard: template-card primary actions that open the normal
 * edit/detail workflow must use LIBRARY_LABELS.edit ("Edit"), never
 * "Edit activities" — including when Customize is also present for starters.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const CARD_ACTION_FILES = [
  "components/event-inventory/inventory-template-list.tsx",
  "components/floor-plan-templates/floor-plan-templates-section.tsx",
  "components/event-order-templates/event-order-template-list.tsx",
  "components/timeline-templates/timeline-templates-section.tsx",
  "components/settings/playbooks-section.tsx",
  "components/questionnaire-templates/questionnaire-template-list.tsx",
  "components/contracts/contract-template-list.tsx",
  "components/communication/message-template-list.tsx",
  "components/packages/package-list.tsx",
  "components/brochures/brochure-list.tsx",
  "components/client-choices-templates/choices-template-list.tsx",
  "components/settings/pipeline-template-list.tsx",
] as const;

const STARTER_CUSTOMIZE_AND_EDIT = [
  "components/event-inventory/inventory-template-list.tsx",
  "components/floor-plan-templates/floor-plan-templates-section.tsx",
  "components/event-order-templates/event-order-template-list.tsx",
  "components/timeline-templates/timeline-templates-section.tsx",
  "components/settings/playbooks-section.tsx",
  "components/questionnaire-templates/questionnaire-template-list.tsx",
] as const;

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("template-card Edit label consistency", () => {
  it("shared labels expose Edit and Customize, not Edit activities", () => {
    const labels = read("components/library/labels.ts");
    assert.match(labels, /edit:\s*"Edit"/);
    assert.match(labels, /customize:\s*"Customize"/);
    assert.match(labels, /preview:\s*"Preview"/);
    assert.match(labels, /sendToClient:\s*"Send to client"/);
    assert.match(labels, /editDetails:\s*"Edit details"/);
    assert.doesNotMatch(labels, /editActivities/);
    assert.doesNotMatch(labels, /Edit activities/);
  });

  for (const file of CARD_ACTION_FILES) {
    it(`${file} has no card-level editActivities / "Edit activities" action label`, () => {
      const src = read(file);
      assert.doesNotMatch(src, /LIBRARY_LABELS\.editActivities/);
      // Ban the literal as a card action label assignment, not instructional prose.
      assert.doesNotMatch(src, /label:\s*["']Edit activities["']/);
      assert.doesNotMatch(src, /label:\s*LIBRARY_LABELS\.editActivities/);
    });
  }

  for (const file of STARTER_CUSTOMIZE_AND_EDIT) {
    it(`${file} starters keep Customize distinct and use Edit for the editor route`, () => {
      const src = read(file);
      assert.match(src, /LIBRARY_LABELS\.customize/);
      assert.match(src, /LIBRARY_LABELS\.edit/);
      assert.match(src, /isStarter/);
      // Editor destination still present (shared starter + owned paths).
      assert.match(src, /id:\s*"edit"/);
    });
  }

  it("Inventory / Floor / Event Order starter Edit hrefs match venue-owned detail routes", () => {
    const cases: Array<{ file: string; hrefRe: RegExp; min: number }> = [
      {
        file: "components/event-inventory/inventory-template-list.tsx",
        hrefRe: /href: `\/library\/inventory-templates\/\$\{template\.id\}`/g,
        min: 2,
      },
      {
        file: "components/floor-plan-templates/floor-plan-templates-section.tsx",
        hrefRe: /href: `\/library\/floor-plan-templates\/\$\{template\.id\}`/g,
        min: 2,
      },
      {
        file: "components/event-order-templates/event-order-template-list.tsx",
        hrefRe: /href: `\/library\/event-order-templates\/\$\{template\.id\}`/g,
        min: 2,
      },
    ];
    for (const { file, hrefRe, min } of cases) {
      const src = read(file);
      const hits = src.match(hrefRe) ?? [];
      assert.ok(hits.length >= min, `${file}: expected ≥${min} shared detail hrefs, got ${hits.length}`);
    }
  });

  it("Preview / Use / Send to client remain distinct labels in families that offer them", () => {
    const inv = read("components/event-inventory/inventory-template-list.tsx");
    assert.match(inv, /LIBRARY_LABELS\.preview/);
    assert.match(inv, /LIBRARY_LABELS\.useTemplate/);
    assert.match(inv, /LIBRARY_LABELS\.sendToClient/);

    const eo = read("components/event-order-templates/event-order-template-list.tsx");
    assert.match(eo, /LIBRARY_LABELS\.preview/);
    assert.match(eo, /LIBRARY_LABELS\.useTemplate/);
    assert.match(eo, /LIBRARY_LABELS\.sendToClient/);

    const floor = read("components/floor-plan-templates/floor-plan-templates-section.tsx");
    assert.match(floor, /LIBRARY_LABELS\.preview/);
    assert.match(floor, /LIBRARY_LABELS\.useFloorPlan/);
    assert.match(floor, /LIBRARY_LABELS\.customize/);
  });

  it("no component under components/ reintroduces editActivities key usage", () => {
    const roots = ["components"];
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === "node_modules" || ent.name === ".worktrees") continue;
        const p = join(dir, ent.name);
        if (ent.isDirectory()) walk(p);
        else if (/\.(tsx|ts)$/.test(ent.name)) {
          const src = readFileSync(p, "utf8");
          if (/editActivities/.test(src) || /label:\s*["']Edit activities["']/.test(src)) {
            offenders.push(p);
          }
        }
      }
    }
    for (const r of roots) walk(resolve(r));
    assert.deepEqual(offenders, [], `unexpected Edit activities card usage: ${offenders.join(", ")}`);
  });
});
