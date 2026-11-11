import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { createInitialSetupInput } from "./constants";
import {
  sectionSaveNotice,
  validateGeneralSettings,
  validateStep,
} from "./validation";

function card() {
  const input = createInitialSetupInput("owner@example.com");
  input.name = "Test Venue";
  input.currency = "USD";
  input.weekStartsOn = 0;
  return input;
}

describe("general settings validation boundary", () => {
  it("A valid currency and week start produce no general-settings errors", () => {
    const input = card();
    input.ownerFullName = "Jordan Rivera";
    input.ownerEmail = "jordan@example.com";
    assert.deepEqual(validateGeneralSettings(input), {});
  });

  it("B a missing owner name does not fail general settings", () => {
    const input = card();
    input.ownerFullName = "";
    assert.equal(validateGeneralSettings(input).ownerFullName, undefined);
    assert.deepEqual(validateGeneralSettings(input), {});
  });

  it("C an invalid or missing owner email does not fail general settings", () => {
    const invalid = card();
    invalid.ownerEmail = "not-an-email";
    assert.deepEqual(validateGeneralSettings(invalid), {});

    const missing = card();
    missing.ownerEmail = "";
    assert.deepEqual(validateGeneralSettings(missing), {});
  });

  it("D the owner step still rejects a missing owner name", () => {
    const input = card();
    input.ownerFullName = "   ";
    input.ownerEmail = "jordan@example.com";
    assert.equal(validateStep("owner", input).ownerFullName, "Owner name is required.");
  });

  it("E the owner step still rejects an invalid owner email", () => {
    const input = card();
    input.ownerFullName = "Jordan Rivera";
    input.ownerEmail = "not-an-email";
    assert.equal(validateStep("owner", input).ownerEmail, "Enter a valid email address.");
  });
});

describe("section save notice", () => {
  it("F a rendered field error is the toast and the focus target", () => {
    const notice = sectionSaveNotice(
      { website: "Enter a valid website URL." },
      (key) => key === "website",
    );
    assert.equal(notice.toast, "Enter a valid website URL.");
    assert.equal(notice.focusKey, "website");
  });

  it("G an unrendered error is the toast and is not described as a highlighted field", () => {
    const notice = sectionSaveNotice(
      { ownerFullName: "Owner name is required." },
      (key) => ["currency", "weekStartsOn"].includes(key),
    );
    assert.equal(notice.toast, "Owner name is required.");
    assert.equal(notice.focusKey, null);
    assert.doesNotMatch(notice.toast, /highlighted/i);
  });
});

describe("existing section rules", () => {
  it("H website, timezone, capacity, colors, and hours keep their messages", () => {
    const website = card();
    website.website = "not a url";
    assert.equal(validateStep("venue-info", website).website, "Enter a valid website URL.");

    const timezone = card();
    timezone.timezone = "";
    assert.equal(validateStep("venue-details", timezone).timezone, "Select a time zone.");

    const capacity = card();
    capacity.capacity = "12.5";
    assert.equal(
      validateStep("venue-details", capacity).capacity,
      "Capacity must be a whole number.",
    );

    const color = card();
    color.primaryColor = "blue";
    assert.equal(
      validateStep("brand", color).primaryColor,
      "Use a 6-digit hex color (e.g. #5D6F5D).",
    );

    const hours = card();
    hours.businessHours = [
      { dayOfWeek: 0, isOpen: true, openTime: "22:00", closeTime: "09:00" },
    ];
    assert.equal(
      validateStep("business-hours", hours)["hours.0"],
      "Closing time must be after opening time.",
    );
  });
});

describe("general settings save path", () => {
  it("validates only the general-settings card and does not rewrite owner staff", () => {
    const service = readFileSync(resolve("lib/venue/service.ts"), "utf8");
    const start = service.indexOf("export async function saveOwnerSection");
    const body = service.slice(start, service.indexOf("export async function dismissOnboarding"));
    assert.match(body, /validateGeneralSettings\(input\)/);
    assert.doesNotMatch(body, /validateStep\("owner"/);
    assert.doesNotMatch(body, /updateOwnerStaff/);
    assert.match(body, /week_starts_on: input\.weekStartsOn/);

    const ui = readFileSync(resolve("components/settings/venue-settings.tsx"), "utf8");
    assert.match(ui, /sectionSaveNotice/);
    assert.match(ui, /focusRenderedError/);
    assert.doesNotMatch(ui, /Please fix the highlighted fields/);
  });
});
