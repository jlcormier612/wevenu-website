/**
 * Booking-to-portal simplification seams:
 * configure once → preset on book → edit optional → prepare/release → invite separately.
 * Questionnaires remain separate; Vendor Network classifications are authoritative.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("booking-to-portal simplification", () => {
  it("booking inherit prepares both Planning checklists without auto-creating commercial drafts", () => {
    const inherit = read("lib/event-setup/inherit.ts");
    assert.doesNotMatch(inherit, /applyInheritedInventoryAndEventOrder/);
    assert.doesNotMatch(inherit, /ensureEventInventory/);
    assert.doesNotMatch(inherit, /ensureEventOrder/);
    assert.match(inherit, /never auto-created from Setup/);
    assert.match(inherit, /applyProfileVenuePlaybook/);
    assert.match(inherit, /venuePlanningPlaybookTemplateId/);
    assert.match(inherit, /applyDefaultVenuePlaybook/);
    assert.match(inherit, /kind", "venue"/);
    assert.match(inherit, /is_default && row\.event_type === eventType/);
    assert.match(inherit, /row\.event_type === eventType/);
    assert.doesNotMatch(inherit, /inviteClient\(/);
    assert.doesNotMatch(inherit, /sendQuestionnaire/);
    assert.doesNotMatch(inherit, /createInvoice/);
  });

  it("prepareAndReleasePortal releases planning and shares timeline without inviting", () => {
    const prepare = read("lib/event-setup/prepare-release.ts");
    const actions = read("app/(app)/events/[id]/setup-actions.ts");
    assert.match(prepare, /releasePlaybookApplication/);
    assert.match(prepare, /shareTimelineWithCouple/);
    assert.doesNotMatch(prepare, /ensureEventInventory/);
    assert.doesNotMatch(prepare, /ensureEventOrder/);
    assert.match(prepare, /never from Setup release/);
    assert.match(prepare, /venuePlanningPlaybookTemplateId/);
    assert.match(prepare, /Could not apply Venue Planning/);
    assert.doesNotMatch(prepare, /inviteClient/);
    assert.doesNotMatch(prepare, /sendQuestionnaire/);
    assert.doesNotMatch(prepare, /createInvoice/);
    assert.match(actions, /prepareAndReleasePortalAction/);
  });

  it("Event Setup exposes Release to client portal and Invite client as separate actions", () => {
    const panel = read("components/events/event-setup-panel.tsx");
    assert.match(panel, /Release to client portal/);
    assert.match(panel, /prepareAndReleasePortalAction/);
    assert.match(panel, /data-testid="prepare-and-release-portal"/);
    assert.match(panel, /inviteLabel="Invite client"/);
    assert.match(
      panel,
      /Questionnaires use authorized send when staff choose — scheduled or immediate\. Inventory selection and Event Orders are separate workflows found on the Inventory &amp; Event Order card — not part of Setup\./,
    );
    assert.doesNotMatch(panel, /not an automated schedule/);
    assert.doesNotMatch(panel, /Event Order are commercial workflows on the Inventory/);
    assert.doesNotMatch(panel, /inviteLabel="Invite client to workspace"/);
    assert.doesNotMatch(panel, /ensureEventInventoryAction/);
    assert.doesNotMatch(panel, /ensureEventOrderAction/);
    assert.doesNotMatch(panel, /Start inventory draft/);
    assert.doesNotMatch(panel, /Start Event Order draft/);
    assert.doesNotMatch(panel, /BookingSetupCard/);
    assert.doesNotMatch(panel, /TimelineSetupCard/);
  });

  it("Setup Profiles defer to Vendor Network classifications without a second recommendation picker", () => {
    const section = read("components/settings/setup-profiles-section.tsx");
    assert.match(section, /Preferred, recommended, and required classifications/);
    assert.match(section, /You do not select a second recommendation list here/);
    assert.doesNotMatch(section, /Optional recommendations/);
    assert.doesNotMatch(section, /recommendedVendorIds: toggleId/);
  });

  it("booking seeds event recommendations from Vendor Network, not Setup Profile refs", () => {
    const inherit = read("lib/event-setup/inherit.ts");
    assert.doesNotMatch(inherit, /applyInheritedVendorRecommendations/);
    assert.doesNotMatch(inherit, /recommendedVendorIds/);
    assert.match(inherit, /ensureEventRecommendationsFromNetworkForVenue/);
    assert.match(inherit, /Vendor Network/);
  });
});
