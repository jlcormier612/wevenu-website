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
  "setup-lead-capture",
  "setup-your-team",
  "setup-financials",
  "connect-stripe",
  "connect-quickbooks",
  "connect-facebook-instagram-lead-ads",
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

  it("keeps INTEGRATION_SETUP_GUIDES to the three integrations the Help fallback depends on", () => {
    assert.deepEqual(INTEGRATION_SETUP_GUIDES.map((g) => g.slug), [
      "connect-stripe",
      "connect-quickbooks",
      "connect-facebook-instagram-lead-ads",
    ]);
    assert.ok(getIntegrationSetupGuide("connect-stripe"));
    // Setup-area guides are reachable via getSetupGuide but must not leak into the
    // integration list that lib/success-library/service.ts appends to Your Venue.
    assert.equal(getIntegrationSetupGuide("setup-your-venue"), null);
  });
});

describe("guide links used elsewhere in the app resolve", () => {
  it("every setup guide link on the integrations settings page exists", () => {
    const source = readFileSync(resolve("app/(app)/settings/integrations/page.tsx"), "utf8");
    const hrefs = [...source.matchAll(/href="\/help\/([a-z0-9-]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length >= 3, "integrations page should link Stripe, QuickBooks and Facebook guides");
    for (const slug of hrefs) {
      assert.ok(getSetupGuide(slug), `integrations page links /help/${slug}, which does not exist`);
    }
  });

  // A guide that sends the owner to #facebook and lands them at the top of the
  // page is the same class of problem as a dead link.
  it("every #anchor a guide points at exists on the integrations page", () => {
    const source = readFileSync(resolve("app/(app)/settings/integrations/page.tsx"), "utf8");
    const anchors = new Set(
      SETUP_GUIDES.flatMap((g) => [g.returnHref, ...g.relatedFeatures.map((f) => f.href)])
        .filter((href) => href.startsWith("/settings/integrations#"))
        .map((href) => href.split("#")[1]),
    );
    assert.ok(anchors.size >= 3, "Stripe, QuickBooks and Facebook guides should deep-link");
    for (const anchor of anchors) {
      assert.ok(
        source.includes(`id="${anchor}"`),
        `guides link to /settings/integrations#${anchor} but no id="${anchor}" exists on that page`,
      );
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

// The Facebook guide carries the one dependency that silently drops leads when a
// venue misses it, so this content is load-bearing rather than editorial.
describe("Facebook & Instagram guide keeps its critical guidance", () => {
  const guide = getSetupGuide("connect-facebook-instagram-lead-ads");

  it("exists", () => {
    assert.ok(guide);
  });

  it("states that a connected Page alone is not enough without an enabled form", () => {
    assert.match(guide!.whyItMatters, /Page connection alone is not enough/i);
    assert.match(guide!.whyItMatters, /at least one Lead Ads form must be enabled/i);
    assert.match(guide!.completion, /at least one Lead Ads form is enabled/i);
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
