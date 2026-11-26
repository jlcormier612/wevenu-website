/**
 * Persistent Refer & Earn header CTA — links to existing Settings referrals only.
 * When REFERRAL_PROGRAM_V1 is off, promotional entry points must stay hidden.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  REFER_EARN_NAV_HREF,
  REFER_EARN_NAV_LABEL,
} from "@/components/shell/refer-earn-nav-cta";

const cta = readFileSync(resolve("components/shell/refer-earn-nav-cta.tsx"), "utf8");
const header = readFileSync(resolve("components/shell/workspace-shell-header.tsx"), "utf8");
const shell = readFileSync(resolve("components/shell/workspace-shell.tsx"), "utf8");
const settingsPage = readFileSync(resolve("app/(app)/settings/page.tsx"), "utf8");
const referralsPage = readFileSync(resolve("app/(app)/settings/referrals/page.tsx"), "utf8");
const settingsTabs = readFileSync(resolve("components/settings/settings-tabs.tsx"), "utf8");
const settingsTabsClient = readFileSync(
  resolve("components/settings/settings-tabs-client.tsx"),
  "utf8",
);
const referralsApi = readFileSync(resolve("app/api/referrals/route.ts"), "utf8");
const referPage = readFileSync(resolve("components/referrals/refer-a-venue-page.tsx"), "utf8");

describe("Refer & Earn nav CTA", () => {
  it("uses the approved label and free-month accessible name", () => {
    assert.equal(REFER_EARN_NAV_LABEL, "Refer & Earn a Free Month");
    assert.match(cta, /aria-label=\{REFER_EARN_NAV_LABEL\}/);
    assert.match(cta, /Gift/);
  });

  it("navigates only to the existing Settings referrals surface", () => {
    assert.equal(REFER_EARN_NAV_HREF, "/settings/referrals");
    assert.match(cta, /href=\{REFER_EARN_NAV_HREF\}/);
    assert.doesNotMatch(cta, /fetch\(|\/api\/referrals/);
  });

  it("is mountable in the venue top header among global actions", () => {
    assert.match(header, /ReferEarnNavCta/);
    assert.match(header, /ml-auto flex shrink-0 items-center/);
  });

  it("gates the header CTA on server referral readiness (default hidden)", () => {
    assert.match(cta, /if \(!enabled\) return null/);
    assert.match(header, /showReferEarn/);
    assert.match(header, /enabled=\{showReferEarn\}/);
    assert.match(shell, /isReferralProgramReady\(\)/);
    assert.match(shell, /showReferEarn=\{isReferralProgramReady\(\)\}/);
  });

  it("keeps a compact mobile treatment without removing shrink constraints", () => {
    assert.match(cta, /shrink-0/);
    assert.match(cta, /hidden max-w-\[14rem\] truncate sm:inline/);
    assert.match(cta, /rounded-full/);
  });

  it("uses soft powder blue invitation styling (not blush/warning rose)", () => {
    assert.match(cta, /#A9C9DA/);
    assert.match(cta, /REFER_EARN_POWDER_BLUE|#A9C9DA/);
    assert.doesNotMatch(cta, /htc-blush|htc-soft-blush|htc-petal/);
    assert.match(cta, /focus-visible:ring-\[color:color-mix\(in_oklch,#A9C9DA/);
  });

  it("hides Settings referral card and tab when program is not ready", () => {
    assert.match(settingsPage, /isReferralProgramReady\(\)/);
    assert.match(settingsTabs, /isReferralProgramReady\(\)/);
    assert.match(settingsTabsClient, /showReferrals/);
    assert.match(settingsTabsClient, /Refer a Venue/);
    assert.match(referralsPage, /redirect\("\/settings"\)/);
    assert.match(referralsPage, /isReferralProgramReady\(\)/);
  });

  it("Settings overview card uses free-month Share the Luv copy when shown", () => {
    assert.match(
      settingsPage,
      /Share the Luv and earn a free month when a venue you refer becomes a paying customer\./,
    );
    assert.doesNotMatch(settingsPage, /thank-you credit/);
  });

  it("never surfaces REFERRAL_PROGRAM_V1 diagnostics to customers", () => {
    assert.doesNotMatch(referralsApi, /diagnosticMessage/);
    assert.doesNotMatch(referralsApi, /REFERRAL_PROGRAM_V1 is off/);
    assert.doesNotMatch(referPage, /REFERRAL_PROGRAM_V1/);
    assert.doesNotMatch(referPage, /readiness\?\.diagnostic/);
    assert.match(referralsApi, /Refer a Venue is not available yet\./);
  });

  it("referral page still explains subscription credit reward (not permanent discount)", () => {
    const page = readFileSync(resolve("components/referrals/refer-a-venue-page.tsx"), "utf8");
    assert.match(page, /subscription credit equal to one month/i);
    assert.match(page, /FREE month/);
    assert.match(page, /paying/i);
    assert.doesNotMatch(page, /permanent discount/i);
  });

  it("Refer a Venue page uses celebratory hero, three-step columns, and locked rewards copy", () => {
    const page = readFileSync(resolve("components/referrals/refer-a-venue-page.tsx"), "utf8");
    const settingsReferrals = readFileSync(
      resolve("app/(app)/settings/referrals/page.tsx"),
      "utf8",
    );
    assert.match(
      settingsReferrals,
      /Introduce another venue to Hello to Cheers and enjoy a little thank-you from us\./,
    );
    assert.match(page, /data-testid="refer-hero"/);
    assert.match(page, /One referral\. One FREE month\./);
    assert.match(page, /Good things are even better when shared\./);
    assert.match(page, /Keep sharing\. Keep earning\./);
    assert.match(page, /data-testid="refer-steps"/);
    assert.match(page, /It&apos;s as easy as 1, 2, 3\./);
    assert.match(page, /Introduce us/);
    assert.match(page, /They join the celebration/);
    assert.match(page, /Enjoy your reward/);
    assert.match(page, /sm:grid-cols-3/);
    assert.match(page, /Learn more about referral rewards/);
    assert.match(page, /data-testid="refer-program-details"/);
    assert.match(page, /Introduce us to a venue/);
    assert.match(page, /Cheers to your referral!/);
    const heroIdx = page.indexOf('data-testid="refer-hero"');
    const stepsIdx = page.indexOf('data-testid="refer-steps"');
    const formIdx = page.indexOf('id="refer-form"');
    const detailsIdx = page.indexOf('data-testid="refer-program-details"');
    assert.ok(heroIdx > 0 && stepsIdx > heroIdx && formIdx > stepsIdx && detailsIdx > 0);
    assert.match(
      page.slice(detailsIdx),
      /Self-referrals and duplicate rewards are not eligible/,
    );
  });
});
