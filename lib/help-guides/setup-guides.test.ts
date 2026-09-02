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

const EXPECTED_SLUGS = [
  "setup-your-venue",
  "setup-bring-your-business",
  "setup-calendar-availability",
  "setup-your-offerings",
  "setup-client-experience",
  "setup-communication",
  "setup-lead-capture",
  "setup-your-team",
  "setup-financials",
];

describe("setup guide library", () => {
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

  // These guides are written for owners who have never used a CRM, so a guide
  // missing its checkpoints or completion state is a real defect, not a nit.
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

  // The 3 standalone integration guides (Connect Stripe, Connect QuickBooks,
  // Connect Facebook & Instagram) were merged into setup-financials and
  // setup-lead-capture so each topic has exactly one authoritative home. That
  // makes INTEGRATION_SETUP_GUIDES (slugs starting with "connect-") empty by
  // design now — lib/success-library/service.ts's fallback still runs, it just
  // has nothing left to add, which is intentional, not a regression.
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
    // Every anchor must actually be unique within its guide, or the deep link is ambiguous.
    for (const guide of [financials, leadCapture]) {
      const anchors = guide.steps.map((s) => s.anchor).filter(Boolean);
      assert.equal(new Set(anchors).size, anchors.length, `${guide.slug} has a duplicate step anchor`);
    }
  });
});

describe("guide links used elsewhere in the app resolve", () => {
  it("every setup guide link on the integrations settings page exists, including its anchor", () => {
    const source = readFileSync(resolve("app/(app)/settings/integrations/page.tsx"), "utf8");
    const hrefs = [...source.matchAll(/href="\/help\/([a-z0-9-]+)(?:#([a-z0-9-]+))?"/g)].map((m) => ({ slug: m[1], anchor: m[2] }));
    assert.ok(hrefs.length >= 3, "integrations page should link Stripe, QuickBooks and Facebook guide content");
    for (const { slug, anchor } of hrefs) {
      const guide = getSetupGuide(slug);
      assert.ok(guide, `integrations page links /help/${slug}, which does not exist`);
      if (anchor) {
        assert.ok(
          guide!.steps.some((s) => s.anchor === anchor),
          `integrations page links /help/${slug}#${anchor}, but no step in that guide has anchor "${anchor}"`,
        );
      }
    }
  });

  // A guide that sends the owner to #facebook and lands them at the top of the
  // page is the same class of problem as a dead link — same check, reversed:
  // the integrations page now links OUT to anchored guide sections (setup-financials
  // #stripe/#quickbooks, setup-lead-capture #facebook), not the other way around.
  it("every #stripe / #quickbooks / #facebook anchor on the integrations page still exists on that page", () => {
    const source = readFileSync(resolve("app/(app)/settings/integrations/page.tsx"), "utf8");
    for (const id of ["stripe", "quickbooks", "facebook"]) {
      assert.ok(source.includes(`id="${id}"`), `integrations page is missing id="${id}"`);
    }
  });

  it("the guide route resolves the whole library, not just integrations", () => {
    const source = readFileSync(resolve("app/(app)/help/[slug]/page.tsx"), "utf8");
    assert.match(source, /getSetupGuide/);
    assert.doesNotMatch(source, /getIntegrationSetupGuide/);
  });

  it("Help & Guides home lists the setup guides", () => {
    const source = readFileSync(resolve("app/(app)/help/page.tsx"), "utf8");
    assert.match(source, /SETUP_GUIDES/);
    assert.match(source, /\/help\/\$\{guide\.slug\}/);
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

// The Facebook section carries the one dependency that silently drops leads when a
// venue misses it, so this content is load-bearing rather than editorial. It now
// lives inside setup-lead-capture (merged from the retired connect-facebook-instagram-
// lead-ads guide) — checked against the full guide text rather than specific
// top-level fields, since setup-lead-capture covers multiple channels and this
// guidance lives in its Facebook-specific steps, not in the guide's overall intro.
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
