import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Lead Workspace conversation recipient sync", () => {
  const leadsRepo = readFileSync(resolve("lib/leads/repository.ts"), "utf8");
  const conversationsRepo = readFileSync(resolve("lib/conversations/repository.ts"), "utf8");
  const commercialUi = readFileSync(resolve("components/booking-journey/commercial-facts.tsx"), "utf8");
  const commercialFacts = readFileSync(resolve("lib/booking-journey/commercial-facts.ts"), "utf8");
  const bookingPanel = readFileSync(resolve("components/booking-journey/booking-journey-panel.tsx"), "utf8");
  const layout = readFileSync(resolve("app/(app)/layout.tsx"), "utf8");

  it("Lead contact edits sync venue_customer_relationships email/name", () => {
    const start = leadsRepo.indexOf("export async function updateLeadInfo");
    const end = leadsRepo.indexOf("export async function setPlannedEventSpace", start + 1);
    const fn = leadsRepo.slice(start, end);
    assert.match(fn, /venue_customer_relationships/);
    assert.match(fn, /relationshipContactPatch/);
    assert.match(fn, /relationship_id/);
  });

  it("Lead contact edits update the existing linked client, not a new client", () => {
    const start = leadsRepo.indexOf("export async function updateLeadInfo");
    const end = leadsRepo.indexOf("export async function setPlannedEventSpace", start + 1);
    const fn = leadsRepo.slice(start, end);
    assert.match(fn, /linkedClientIdentityPatch/);
    assert.match(fn, /convertedClient\.id/);
    assert.doesNotMatch(fn, /insertClient/);
    assert.doesNotMatch(fn, /\.from\("clients"\)[\s\S]*\.insert\(/);
  });

  it("conversation recipient email prefers live client/lead over stale relationship row", () => {
    const start = conversationsRepo.indexOf("export async function getConversationRecipientEmail");
    const end = conversationsRepo.indexOf("function coupleDisplayName", start + 1);
    const fn = conversationsRepo.slice(start, end);
    assert.match(fn, /\.from\("clients"\)/);
    assert.match(fn, /\.from\("leads"\)/);
    assert.match(fn, /venue_customer_relationships/);
    const clientsAt = fn.indexOf('.from("clients")');
    const leadsAt = fn.indexOf('.from("leads")');
    const relAt = fn.indexOf("venue_customer_relationships");
    assert.ok(clientsAt >= 0 && leadsAt > clientsAt && relAt > leadsAt);
  });

  it("customer-facing Booking Details copy replaces Commercial heading", () => {
    assert.match(commercialUi, /Booking Details/);
    assert.match(commercialUi, /What they booked/);
    assert.doesNotMatch(commercialUi, />\s*Commercial\s*</);
    assert.match(commercialFacts, /Choosing a package saves it for this opportunity/);
    assert.match(commercialFacts, /Accepting a package does not execute the contract/);
  });

  it("Create contract failures stay on the Lead with a useful message", () => {
    assert.match(bookingPanel, /Stay on this Lead and try again/);
    assert.doesNotMatch(bookingPanel, /Could not open Create contract\. Reload and try again/);
  });

  it("Lead save stays on the Lead Workspace without a hard reload race", () => {
    const editForm = readFileSync(resolve("components/leads/lead-edit-form.tsx"), "utf8");
    assert.match(editForm, /router\.replace\(`\/leads\/\$\{lead\.id\}`\)/);
    assert.doesNotMatch(editForm, /router\.refresh\(\)/);
    assert.match(editForm, /Stay on this Lead and try again/);
  });

  it("workspace layout recovers pathname from Referer when x-pathname is missing", () => {
    assert.match(layout, /x-pathname/);
    assert.match(layout, /referer/i);
    assert.match(layout, /isVenueReadyToInviteCouples/);
    assert.match(layout, /redirect\("\/setup-hub"\)/);
  });

  it("Lead Workspace paths are not pre-graduation allowed — graduation must stay true for acceptance", () => {
    const paths = readFileSync(resolve("lib/setup-hub/pre-graduation-paths.ts"), "utf8");
    assert.doesNotMatch(paths, /"\/leads"/);
  });
});
