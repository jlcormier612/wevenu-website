import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  INTEGRATION_SETUP_GUIDES,
  SETUP_GUIDES,
  getIntegrationSetupGuide,
  getSetupGuide,
} from "@/lib/help-guides/setup-guides";
import { FINAL_HELP_ARTICLES } from "@/lib/help-guides/final-articles";
import { LEGACY_SETUP_GUIDE_REDIRECTS } from "@/lib/setup-hub/help-crosswalk";

const EXPECTED_SLUGS = [
  "setup-your-venue",
  "setup-bring-your-business",
  "setup-calendar-availability",
  "understanding-your-calendar",
  "setup-your-offerings",
  "setup-client-experience",
  "setup-communication",
  "setup-lead-capture",
  "setup-your-team",
  "setup-financials",
];

const published = new Set(FINAL_HELP_ARTICLES.map((a) => a.slug));

describe("setup guide library (module retained; Help IA uses final articles)", () => {
  it("ships a guide for every setup area, with no duplicate slugs", () => {
    assert.deepEqual(SETUP_GUIDES.map((g) => g.slug), EXPECTED_SLUGS);
    assert.equal(new Set(SETUP_GUIDES.map((g) => g.slug)).size, EXPECTED_SLUGS.length);
  });

  it("resolves every slug through getSetupGuide", () => {
    for (const slug of EXPECTED_SLUGS) {
      assert.ok(getSetupGuide(slug), `${slug} must resolve`);
    }
    assert.equal(getSetupGuide("not-a-guide"), null);
  });

  it("gives every guide the full prescriptive shape", () => {
    for (const guide of SETUP_GUIDES) {
      const where = guide.slug;
      for (const field of ["title", "shortTitle", "intro", "time", "whyItMatters", "completion", "returnHref", "returnLabel"] as const) {
        assert.ok(guide[field]?.trim(), `${where}.${field} must be present`);
      }
      assert.ok(guide.prerequisites.length > 0, `${where} must list prerequisites`);
      assert.ok(guide.troubleshooting.length > 0, `${where} must list troubleshooting`);
      assert.ok(guide.steps.length >= 3, `${where} must have real steps`);
      assert.ok(guide.returnHref.startsWith("/"), `${where}.returnHref must be an internal route`);
      for (const feature of guide.relatedFeatures) {
        assert.ok(feature.href.startsWith("/"), `${where} related link ${feature.href} must be internal`);
        assert.ok(feature.label?.trim(), `${where} related link must be labelled`);
      }
    }
  });

  it("numbers steps sequentially from 1 and gives each an action and a checkpoint", () => {
    for (const guide of SETUP_GUIDES) {
      guide.steps.forEach((step, i) => {
        assert.equal(step.number, i + 1, `${guide.slug} step ${i + 1} is misnumbered`);
        assert.ok(step.title?.trim(), `${guide.slug} step ${step.number} needs a title`);
        assert.ok(step.doThis?.trim(), `${guide.slug} step ${step.number} needs an action`);
        assert.ok(step.lookFor?.trim(), `${guide.slug} step ${step.number} needs a checkpoint`);
      });
    }
  });

  it("has no standalone connect-* guides left — their content lives in setup-financials and setup-lead-capture", () => {
    assert.deepEqual(INTEGRATION_SETUP_GUIDES, []);
    assert.equal(getIntegrationSetupGuide("connect-stripe"), null);
    assert.equal(getIntegrationSetupGuide("connect-quickbooks"), null);
    assert.equal(getIntegrationSetupGuide("connect-facebook-instagram-lead-ads"), null);
    assert.equal(getIntegrationSetupGuide("setup-your-venue"), null);
  });

  it("merges Stripe, QuickBooks, and Facebook/Instagram detail into the two hub guides with real deep-link anchors", () => {
    const financials = getSetupGuide("setup-financials")!;
    const leadCapture = getSetupGuide("setup-lead-capture")!;
    assert.ok(financials.steps.some((s) => s.anchor === "stripe"), "setup-financials must anchor a Stripe step");
    assert.ok(financials.steps.some((s) => s.anchor === "quickbooks"), "setup-financials must anchor a QuickBooks step");
    assert.ok(leadCapture.steps.some((s) => s.anchor === "facebook"), "setup-lead-capture must anchor a Facebook step");
    for (const guide of [financials, leadCapture]) {
      const anchors = guide.steps.map((s) => s.anchor).filter(Boolean);
      assert.equal(new Set(anchors).size, anchors.length, `${guide.slug} has a duplicate step anchor`);
    }
  });
});

describe("Help routes retire Setup Guides in favor of final articles", () => {
  it("redirects every setup-* guide slug to a published final article", () => {
    for (const slug of EXPECTED_SLUGS) {
      if (!slug.startsWith("setup-")) continue;
      const target = LEGACY_SETUP_GUIDE_REDIRECTS[slug];
      assert.ok(target, `${slug} must have a redirect`);
      assert.ok(published.has(target), `${slug} → ${target} must be published`);
    }
  });

  it("Help article page redirects legacy setup guides and serves published articles only", () => {
    const articlePage = readFileSync(resolve("app/(app)/help/[slug]/page.tsx"), "utf8");
    assert.match(articlePage, /LEGACY_SETUP_GUIDE_REDIRECTS/);
    assert.match(articlePage, /getPublishedArticleBySlug/);
    assert.doesNotMatch(articlePage, /getSetupGuide/);
    assert.doesNotMatch(articlePage, /IntegrationSetupGuideView/);
  });

  it("Help & Guides home stays editorial (no Setup Guides index)", () => {
    const source = readFileSync(resolve("app/(app)/help/page.tsx"), "utf8");
    assert.match(source, /HELP_GUIDES_TAGLINE/);
    assert.doesNotMatch(source, /SETUP_GUIDES/);
    assert.doesNotMatch(source, /coming soon/i);
  });

  it("Settings links point at final Help articles, not /help/setup-*", () => {
    for (const file of [
      "app/(app)/settings/integrations/page.tsx",
      "app/(app)/settings/availability/page.tsx",
      "app/(app)/settings/import/page.tsx",
      "app/(app)/settings/migration/page.tsx",
    ]) {
      const source = readFileSync(resolve(file), "utf8");
      assert.doesNotMatch(source, /href="\/help\/setup-/);
      const hrefs = [...source.matchAll(/href="\/help\/([a-z0-9-]+)/g)].map((m) => m[1]);
      for (const slug of hrefs) {
        assert.ok(published.has(slug), `${file} links unpublished Help slug /help/${slug}`);
      }
    }
  });

  it("every #stripe / #quickbooks / #facebook anchor on the integrations page still exists", () => {
    const source = readFileSync(resolve("app/(app)/settings/integrations/page.tsx"), "utf8");
    for (const id of ["stripe", "quickbooks", "facebook"]) {
      assert.ok(source.includes(`id="${id}"`), `integrations page is missing id="${id}"`);
    }
  });
});

describe("Communication setup guide", () => {
  const guide = getSetupGuide("setup-communication");

  it("exists and describes the four sendable channels", () => {
    assert.ok(guide);
    const text = JSON.stringify(guide);
    assert.match(text, /Email/);
    assert.match(text, /SMS/);
    assert.match(text, /Portal message/);
    assert.match(text, /Internal note/);
  });

  it("does not document Voicemail, Push, or Phone call as send actions", () => {
    const text = JSON.stringify(guide);
    assert.doesNotMatch(text, /Voicemail/);
    assert.doesNotMatch(text, /Phone call/);
    assert.doesNotMatch(text, /\bPush\b/);
  });

  it("says Email and texting are platform-level, not venue Settings", () => {
    const text = JSON.stringify(guide);
    assert.match(text, /platform/i);
    assert.match(text, /venue Settings/);
    assert.match(text, /Communication Health/);
  });
});

describe("Facebook & Instagram guidance keeps its critical warnings", () => {
  const guide = getSetupGuide("setup-lead-capture");

  it("exists", () => {
    assert.ok(guide);
  });

  it("warns that a Page with zero enabled forms silently receives nothing", () => {
    const text = JSON.stringify(guide);
    assert.match(text, /zero forms are enabled/i);
    assert.match(text, /will not arrive in Hello to Cheers/i);
    assert.match(text, /Do not stop after selecting the Page/i);
  });

  it("warns that a green Connected badge alone is not proof of readiness", () => {
    const text = JSON.stringify(guide);
    assert.match(text, /green Connected badge by itself/i);
    assert.match(text, /Page is connected but no forms are shown, the setup is incomplete/i);
  });

  it("tells the venue what to do when the Page has no Lead Ads forms at all", () => {
    const text = JSON.stringify(guide);
    assert.match(text, /create a real Lead Ads form|Create a Meta Lead Ads form/i);
    assert.match(text, /normal Facebook contact form or a post is a Lead Ads form/i);
  });

  it("keeps the leadgen subscription described as automatic, not manual webhook setup", () => {
    const text = JSON.stringify(guide);
    assert.match(text, /do not need to manually configure a webhook/i);
  });

  it("tells the venue not to look for a separate Instagram connection", () => {
    const text = JSON.stringify(guide);
    assert.match(text, /do not connect Instagram separately/i);
    assert.match(text, /second Instagram Connect button|separate Instagram API key/i);
  });

  it("does not claim Instagram-placement delivery is verified", () => {
    const text = JSON.stringify(guide);
    assert.doesNotMatch(text, /Instagram (leads are|placement is) verified/i);
  });
});
