import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const portalShell = readFileSync(resolve("components/portal/portal-shell.tsx"), "utf8");
const rsvpRoute = readFileSync(resolve("app/rsvp/[token]/page.tsx"), "utf8");
const rsvpPage = readFileSync(resolve("components/wedding-website/rsvp-page.tsx"), "utf8");
const hostedSite = readFileSync(resolve("components/wedding-website/wedding-website.tsx"), "utf8");
const resolveSrc = readFileSync(resolve("lib/event-experience/resolve.ts"), "utf8");

function sliceFrom(src: string, startMarker: string, endMarker?: string): string {
  const start = src.indexOf(startMarker);
  assert.ok(start >= 0, `missing ${startMarker}`);
  const from = start;
  const end = endMarker ? src.indexOf(endMarker, from + startMarker.length) : src.length;
  assert.ok(end > from, `missing end marker after ${startMarker}`);
  return src.slice(from, end);
}

describe("resolver stored-value map explicitness", () => {
  it("lists social_event and birthday_milestone in EVENT_TYPE_VALUE_TO_PROFILE", () => {
    const valueBlock = sliceFrom(
      resolveSrc,
      "const EVENT_TYPE_VALUE_TO_PROFILE",
      "const EVENT_TYPE_LABEL_TO_PROFILE",
    );
    assert.match(valueBlock, /social_event:\s*"general_event"/);
    assert.match(valueBlock, /birthday_milestone:\s*"general_event"/);
  });
});

describe("Portal Home / YourWeddingSection", () => {
  it("renders launch heading/prompt from experienceProfile, not hardcoded wedding copy", () => {
    const section = sliceFrom(portalShell, "function YourWeddingSection");
    assert.match(section, /homeLaunchHeading\(experienceProfile\)/);
    assert.match(section, /homeLaunchPrompt\(experienceProfile\)/);
    assert.doesNotMatch(section, /Your Wedding/);
    assert.doesNotMatch(section, /What would you like to work on for your wedding\?/);
    assert.doesNotMatch(section, /eventType\s*===/);
  });

  it("receives PortalContext.experienceProfile from the Home call site", () => {
    const call = sliceFrom(portalShell, "<YourWeddingSection", "/>");
    assert.match(call, /experienceProfile=\{context\.experienceProfile\}/);
  });
});

describe("RSVP page", () => {
  it("resolves metadata through the experience profile helpers", () => {
    assert.match(rsvpRoute, /resolveExperienceProfile\(event\?\.eventType\)/);
    assert.match(rsvpRoute, /rsvpDocumentTitle\(/);
    assert.match(rsvpRoute, /rsvpDocumentDescription\(/);
    assert.doesNotMatch(rsvpRoute, /RSVP — \$\{coupleName\}'s Wedding/);
    assert.doesNotMatch(rsvpRoute, /eventType\s*===/);
  });

  it("resolves website links through the experience profile helpers", () => {
    assert.match(rsvpPage, /resolveExperienceProfile\(event\?\.eventType\)/);
    assert.match(rsvpPage, /rsvpWebsiteVisitLabel\(coupleName, experienceProfile\)/);
    assert.match(rsvpPage, /rsvpWebsiteInlineLabel\(experienceProfile\)/);
    assert.doesNotMatch(rsvpPage, /Visit \{coupleName\}'s wedding website/);
    assert.doesNotMatch(rsvpPage, />wedding website</);
    assert.doesNotMatch(rsvpPage, /eventType\s*===/);
  });
});

describe("hosted-site hero", () => {
  it("uses the experience profile eyebrow instead of raw event_type or a Wedding default", () => {
    const hero = sliceFrom(hostedSite, "export function Hero(", "export function ");
    assert.match(hero, /hostedHeroOccasionLabel\(resolveExperienceProfile\(site\.event\?\.eventType\)\)/);
    assert.match(hero, /\{occasionEyebrow\}/);
    assert.equal((hero.match(/\{occasionEyebrow\}/g) ?? []).length, 4);
    assert.doesNotMatch(hero, /eventType\?\.replace/);
    assert.doesNotMatch(hero, /\?\? "Wedding"/);
    assert.doesNotMatch(hero, /eventType\s*===/);
  });
});
