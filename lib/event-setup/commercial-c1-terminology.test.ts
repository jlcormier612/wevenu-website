/**
 * Commercial terminology — Setup excludes Inventory/EO; commercial home stays on event tabs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("C1 commercial terminology and entry points", () => {
  it("Setup Profiles no longer embed Inventory/Event Order starting templates", () => {
    const section = read("components/settings/setup-profiles-section.tsx");
    assert.doesNotMatch(section, /Starting inventory template/);
    assert.doesNotMatch(section, /Starting Event Order template/);
    assert.doesNotMatch(section, /Starting inventory offering/);
    assert.doesNotMatch(section, /Starting event-order package/);
    assert.match(section, /commercial workflows/);
  });

  it("Overview Setup does not list Inventory/Event Order as setup rows", () => {
    const panel = read("components/events/event-setup-panel.tsx");
    assert.match(panel, /commercial workflows on their own event tabs/);
    assert.doesNotMatch(panel, /Open Inventory/);
    assert.doesNotMatch(panel, /Open Event Order/);
    assert.doesNotMatch(panel, /EventInventorySetupEditor/);
    assert.doesNotMatch(panel, /EventOrderSetupEditor/);
  });

  it("Event Order tab presents the commercial workspace without replacing panels", () => {
    const detail = read("components/events/event-detail.tsx");
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
