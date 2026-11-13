import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderEmailTemplate } from "@/shared/email/templates/registry";

describe("white_glove_welcome — intake CTA", () => {
  const intakeUrl =
    "https://app.sandbox.hellotocheers.com/onboarding/white-glove/intake_test_token";

  const rendered = renderEmailTemplate("white_glove_welcome", {
    firstName: "Jennifer",
    venueName: "WG Stripe C",
    planName: "Gather",
    intakeUrl,
  });

  it("keeps the intake URL in the plain-text part", () => {
    assert.match(rendered.text, /Share a few details about your venue here:/);
    assert.match(rendered.text, new RegExp(intakeUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("renders a branded HTML button instead of a bare URL paragraph", () => {
    assert.match(rendered.html, />Share venue details</);
    assert.match(
      rendered.html,
      /display:inline-block;background:#2f3d2f;color:#fffdf9/,
    );
    assert.match(
      rendered.html,
      new RegExp(`href="${intakeUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
    );
    // Primary CTA must not be only a long raw URL in a body paragraph.
    assert.doesNotMatch(
      rendered.html,
      /Share a few details about your venue here: https:\/\//,
    );
  });

  it("still offers a secondary text link for clients that block buttons", () => {
    assert.match(rendered.html, /Or open this link:/);
  });

  it("does not push self-setup or Setup Hub work", () => {
    assert.match(rendered.text, /won't receive login credentials yet/);
    assert.match(rendered.text, /no Setup Hub work for you to complete on your own/);
    assert.match(rendered.text, /nothing you need to schedule right now/);
    assert.doesNotMatch(rendered.text, /Setup Hub to get started/i);
    assert.doesNotMatch(rendered.text, /You're all set/i);
  });
});

describe("white_glove_welcome — missing intake URL", () => {
  it("falls back to short-link-coming-soon copy without a button", () => {
    const rendered = renderEmailTemplate("white_glove_welcome", {
      firstName: "Jennifer",
      venueName: "WG Stripe C",
      planName: "Gather",
    });
    assert.match(rendered.text, /We'll send you a short link/);
    assert.doesNotMatch(rendered.html, />Share venue details</);
  });
});
