/**
 * Persistent Refer & Earn header CTA — links to existing Settings referrals only.
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
const settingsPage = readFileSync(resolve("app/(app)/settings/page.tsx"), "utf8");
const referralsPage = readFileSync(resolve("app/(app)/settings/referrals/page.tsx"), "utf8");

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

  it("is mounted in the venue top header among global actions", () => {
    assert.match(header, /ReferEarnNavCta/);
    assert.match(header, /ml-auto flex shrink-0 items-center/);
  });

  it("keeps a compact mobile treatment without removing shrink constraints", () => {
    assert.match(cta, /shrink-0/);
    assert.match(cta, /hidden max-w-\[14rem\] truncate sm:inline/);
    assert.match(cta, /rounded-full/);
    assert.match(cta, /htc-soft-blush|htc-blush/);
  });

  it("does not remove the Settings referral card or page", () => {
    assert.match(settingsPage, /href: "\/settings\/referrals"/);
    assert.match(settingsPage, /Refer a Venue/);
    assert.match(referralsPage, /ReferAVenuePage/);
  });

  it("Settings overview card uses free-month Share the Luv copy", () => {
    assert.match(
      settingsPage,
      /Share the Luv and earn a free month when a venue you refer becomes a paying customer\./,
    );
    assert.doesNotMatch(settingsPage, /thank-you credit/);
  });

  it("referral page still explains one-time credit (not permanent discount)", () => {
    const page = readFileSync(resolve("components/referrals/refer-a-venue-page.tsx"), "utf8");
    assert.match(page, /one-time credit/i);
    assert.match(page, /free month/i);
    assert.match(page, /paying/i);
  });
});
