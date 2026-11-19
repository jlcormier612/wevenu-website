/**
 * LUV-OPTOUT — deterministic master Enable Luv coverage (no paid OpenAI).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  defaultLuvSettings,
  isLuvDraftingEffectivelyEnabled,
  isLuvEnabled,
  isLuvObservationsEffectivelyEnabled,
  luvSettingsFailClosed,
} from "@/lib/luv/settings";

const settingsSrc = readFileSync(resolve("lib/luv/settings.ts"), "utf8");
const draftRoute = readFileSync(resolve("app/api/luv/draft/route.ts"), "utf8");
const askRoute = readFileSync(resolve("app/api/portal/luv-ask/route.ts"), "utf8");
const conciergeRoute = readFileSync(resolve("app/api/rsvp/concierge/route.ts"), "utf8");
const rollUpRoute = readFileSync(resolve("app/api/luv/roll-up/route.ts"), "utf8");
const recommendationService = readFileSync(resolve("lib/luv/recommendation-service.ts"), "utf8");
const luvSettingsSection = readFileSync(resolve("components/settings/luv-settings-section.tsx"), "utf8");
const migration = readFileSync(
  resolve("supabase/migrations/20270204120000_luv_settings_master_enabled.sql"),
  "utf8",
);
const smartExtract = readFileSync(resolve("lib/migration/smart-extract.ts"), "utf8");
const emailExtract = readFileSync(resolve("lib/lead-intake/email-extract.ts"), "utf8");

describe("LUV-OPTOUT master helpers", () => {
  it("1. default / no-row shape is master ON", () => {
    const defaults = defaultLuvSettings();
    assert.equal(defaults.enabled, true);
    assert.equal(isLuvEnabled(defaults), true);
    assert.equal(defaults.observationsEnabled, true);
    assert.equal(defaults.draftingEnabled, true);
  });

  it("2. master OFF overrides nested drafting and observations", () => {
    const off = {
      enabled: false,
      observationsEnabled: true,
      draftingEnabled: true,
    };
    assert.equal(isLuvEnabled(off), false);
    assert.equal(isLuvDraftingEffectivelyEnabled(off), false);
    assert.equal(isLuvObservationsEffectivelyEnabled(off), false);
  });

  it("3. master ON restores nested preference effectiveness", () => {
    const nestedOff = {
      enabled: true,
      observationsEnabled: false,
      draftingEnabled: false,
    };
    assert.equal(isLuvEnabled(nestedOff), true);
    assert.equal(isLuvDraftingEffectivelyEnabled(nestedOff), false);
    assert.equal(isLuvObservationsEffectivelyEnabled(nestedOff), false);

    const nestedOn = {
      enabled: true,
      observationsEnabled: true,
      draftingEnabled: true,
    };
    assert.equal(isLuvDraftingEffectivelyEnabled(nestedOn), true);
    assert.equal(isLuvObservationsEffectivelyEnabled(nestedOn), true);
  });

  it("4. settings-read errors fail closed (enabled false)", () => {
    const closed = luvSettingsFailClosed();
    assert.equal(closed.enabled, false);
    assert.equal(isLuvEnabled(closed), false);
    assert.match(settingsSrc, /luvSettingsFailClosed/);
    assert.match(settingsSrc, /reason: "read_error"/);
    assert.match(settingsSrc, /if \(!result\.ok\) return luvSettingsFailClosed\(\)/);
  });

  it("5. unauthorized settings writes are rejected (throw / action result)", () => {
    assert.match(settingsSrc, /LuvSettingsUnauthorizedError/);
    assert.match(settingsSrc, /throw new LuvSettingsUnauthorizedError/);
    const actions = readFileSync(resolve("app/(app)/settings/luv-settings-actions.ts"), "utf8");
    assert.match(actions, /error: "unauthorized"/);
  });

  it("6. settings loads are keyed by venue_id (multi-venue isolation)", () => {
    assert.match(settingsSrc, /\.eq\("venue_id", venueId\)/);
    assert.match(settingsSrc, /venue_id: venue\.id/);
    assert.match(settingsSrc, /onConflict: "venue_id"/);
    assert.match(settingsSrc, /loadRowForVenueId\(venue\.id/);
  });
});

describe("LUV-OPTOUT execution gates (source contracts)", () => {
  it("10. draft / roll-up / recommendation manufacture gated before AI/writes", () => {
    assert.match(draftRoute, /isLuvEnabled\(settings\)/);
    assert.match(draftRoute, /isLuvDraftingEffectivelyEnabled\(settings\)/);
    const draftGate = draftRoute.indexOf("isLuvEnabled(settings)");
    const draftAi = draftRoute.indexOf("await openAiChatCompletion");
    assert.ok(draftGate > 0 && draftAi > draftGate);

    assert.match(rollUpRoute, /isLuvMasterEnabledForCurrentVenue/);
    const rollPost = rollUpRoute.indexOf("export async function POST");
    const rollGate = rollUpRoute.indexOf("isLuvMasterEnabledForCurrentVenue", rollPost);
    const rollAi = rollUpRoute.indexOf("await generateRollUp", rollPost);
    assert.ok(rollPost > 0 && rollGate > rollPost && rollAi > rollGate);

    assert.match(recommendationService, /isLuvMasterEnabledForCurrentVenue/);
    assert.match(
      recommendationService,
      /if \(!\(await isLuvMasterEnabledForCurrentVenue\(\)\)\) return \[\]/,
    );
  });

  it("8/9. portal Ask + guest concierge gated before OpenAI", () => {
    assert.match(askRoute, /isLuvEnabled\(settings\)/);
    assert.match(askRoute, /isLuvDraftingEffectivelyEnabled\(settings\)/);
    const askGate = askRoute.indexOf("isLuvEnabled(settings)");
    const askAi = askRoute.indexOf("await openAiChatCompletion");
    assert.ok(askGate > 0 && askAi > askGate);

    assert.match(conciergeRoute, /isLuvMasterEnabledForVenueId\(venueId\)/);
    assert.match(conciergeRoute, /couple_guests/);
    const cGate = conciergeRoute.indexOf("isLuvMasterEnabledForVenueId");
    const cAi = conciergeRoute.indexOf("await openAiChatCompletion");
    assert.ok(cGate > 0 && cAi > cGate);
  });

  it("settings UI keeps card + nested disabled state while master OFF", () => {
    assert.match(luvSettingsSection, /Enable Luv/);
    assert.match(
      luvSettingsSection,
      /Turn this off to hide Luv from your venue workspace and your clients/,
    );
    assert.match(luvSettingsSection, /disabled=\{!masterOn\}/);
  });

  it("migration adds enabled DEFAULT true without destructive history changes", () => {
    assert.match(migration, /add column if not exists enabled boolean not null default true/);
    assert.doesNotMatch(migration, /drop table|delete from|truncate/i);
  });

  it("14. independent AI import/extraction left operational (not master-gated)", () => {
    assert.doesNotMatch(smartExtract, /isLuvMasterEnabled|isLuvEnabled/);
    assert.doesNotMatch(emailExtract, /isLuvMasterEnabled|isLuvEnabled/);
  });
});

describe("LUV-OPTOUT UI absence contracts", () => {
  it("7. staff Luv tab/panel gated on luvEnabled", () => {
    const lead = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    const event = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
    assert.match(lead, /luvEnabled \? \(/);
    assert.match(lead, /TabsTrigger[\s\S]*value="luv"/);
    assert.match(event, /luvEnabled \? \(/);
    assert.match(event, /value="luv"/);
  });

  it("8. portal FAB gated on luvEnabled", () => {
    const portal = readFileSync(resolve("components/portal/portal-shell.tsx"), "utf8");
    assert.match(portal, /luvEnabled \? \([\s\S]*FloatingLuvWidget/);
  });

  it("9. guest concierge gated on luvEnabled", () => {
    const site = readFileSync(resolve("components/wedding-website/wedding-website.tsx"), "utf8");
    assert.match(site, /luvEnabled \? \([\s\S]*GuestConciergeWidget/);
  });
});
