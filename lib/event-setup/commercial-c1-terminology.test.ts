/**
 * C1 commercial consolidation — navigation & terminology contracts.
 * Copy-only: no schema, no lifecycle, no merge of selection runtimes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("C1 commercial terminology and entry points", () => {
  it("Setup Profiles label Event Order and Inventory starting refs as templates, not packages/offerings", () => {
    const section = read("components/settings/setup-profiles-section.tsx");
    assert.match(section, /Starting inventory template/);
    assert.match(section, /Starting Event Order template/);
    assert.match(section, /Select a starting inventory template/);
    assert.match(section, /Select a starting Event Order template/);
    assert.doesNotMatch(section, /Starting inventory offering/);
    assert.doesNotMatch(section, /Starting event-order package/);
    assert.doesNotMatch(section, /Select a starting package…/);
    assert.doesNotMatch(section, /Select a starting offering…/);
    assert.match(section, /event Inventory tab/);
    assert.match(section, /event Event Order tab/);
  });

  it("Overview Setup treats Inventory/Event Order as readiness deep links into event tabs", () => {
    const panel = read("components/events/event-setup-panel.tsx");
    assert.match(panel, /Inventory and Event Order rows here are readiness/);
    assert.match(panel, /event Inventory and Event Order tabs/);
    assert.match(panel, /Open Inventory/);
    assert.match(panel, /Open Event Order/);
    assert.match(panel, /data-testid=\{`event-setup-open-\$\{step\}`\}/);
  });

  it("Event Order tab presents the commercial workspace without replacing panels", () => {
    const detail = read("components/events/event-detail.tsx");
    // C3: status strip supersedes the C1 static intro; same commercial home.
    assert.match(detail, /EventCommercialStatusStrip|event-commercial-status-strip/);
    assert.match(detail, /ClientChoicesPanel/);
    assert.match(detail, /EventOrderPanel/);
    assert.match(detail, /EventInventoryPanel/);
  });

  it("Library keeps Packages distinct from Event Order Templates", () => {
    const library = read("app/(app)/library/page.tsx");
    assert.match(library, /title="Packages"/);
    assert.match(library, /Distinct from Event Order Templates/);
    assert.match(library, /title="Event Order Templates"/);
    assert.match(library, /title="Inventory Templates"/);
  });

  it("does not merge inventory selection and client_choices entry points", () => {
    const detail = read("components/events/event-detail.tsx");
    assert.match(detail, /TabsContent value="inventory"/);
    assert.match(detail, /TabsContent value="event-order"/);
    assert.match(detail, /ClientChoicesPanel/);
    assert.match(detail, /EventInventoryPanel/);
  });
});
