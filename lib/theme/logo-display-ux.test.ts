/**
 * Logo chrome: contain (not cover) + honest upload guidance.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("logo display + upload honesty", () => {
  it("uses object-contain with ivory tiles in vendor and couple chrome", () => {
    const vendorShell = read("components/vendor-app/vendor-app-shell.tsx");
    const portal = read("components/portal/portal-shell.tsx");
    const hero = read("components/vendor-app/vendor-venue-hero.tsx");
    assert.match(vendorShell, /object-contain/);
    assert.doesNotMatch(vendorShell, /logoUrl[\s\S]{0,200}object-cover/);
    assert.match(portal, /context\.venue\.logoUrl[\s\S]{0,280}object-contain/);
    assert.match(hero, /venue\.logoUrl[\s\S]{0,200}object-contain/);
  });

  it("shows Hello to Cheers Wordmark in client portal header chrome", () => {
    const portal = read("components/portal/portal-shell.tsx");
    assert.match(portal, /import \{ Wordmark \} from "@\/components\/brand\/wordmark"/);
    assert.match(
      portal,
      /Sticky Header[\s\S]{0,500}<Wordmark[\s\S]{0,180}sizeClassName=/,
    );
  });

  it("tells venue + vendor uploaders how small chrome will show the mark", () => {
    const venue = read("components/settings/venue-settings.tsx");
    const vendor = read("components/vendor-app/vendor-profile-form.tsx");
    const upload = read("components/ui/image-upload.tsx");
    assert.match(venue, /objectFit="contain"/);
    assert.match(venue, /showLogoSizePreviews/);
    assert.match(venue, /letterboxed|wide wordmarks/i);
    assert.match(vendor, /object-contain/);
    assert.match(vendor, /letterboxed|wide wordmarks/i);
    assert.match(upload, /showLogoSizePreviews/);
  });
});
