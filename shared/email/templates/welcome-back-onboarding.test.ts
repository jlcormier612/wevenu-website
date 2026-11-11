import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { renderEmailTemplate } from "./registry";

const WG_COPY =
  "Since you've selected White Glove onboarding, our team will be in touch personally to coordinate your setup";
const SELF_COPY = "your subscription is active and you can begin settling in";
const VERIFY_COPY = "independent of how you chose to onboard";

function renderWelcomeBack(vars: Record<string, unknown>) {
  return renderEmailTemplate("welcome_back", {
    firstName: "Ellie",
    venueName: "The Willow Grove",
    ...vars,
  });
}

describe("welcome_back — onboarding-method copy", () => {
  it("Former Weven + White Glove: coordination copy, not self-setup settling-in", () => {
    const rendered = renderWelcomeBack({ onboardingType: "white_glove" });
    assert.match(rendered.text, /^Hi Ellie,/);
    assert.match(rendered.text, /The Willow Grove/);
    assert.match(rendered.text, new RegExp(WG_COPY));
    assert.match(rendered.text, new RegExp(VERIFY_COPY));
    assert.doesNotMatch(rendered.text, /begin settling in/);
    assert.doesNotMatch(rendered.text, /pending approval/i);
  });

  it("Former Weven + self-setup: settling-in copy, personal verification still explained", () => {
    const rendered = renderWelcomeBack({ onboardingType: "self_guided" });
    assert.match(rendered.text, /^Hi Ellie,/);
    assert.match(rendered.text, new RegExp(SELF_COPY));
    assert.match(rendered.text, new RegExp(VERIFY_COPY));
    assert.doesNotMatch(rendered.text, /White Glove onboarding/);
  });

  it("Standard customer shape + White Glove (if Welcome Back requested): coordination copy", () => {
    const rendered = renderWelcomeBack({
      firstName: "Sam",
      venueName: "Cedar Hall",
      onboardingType: "white_glove",
    });
    assert.match(rendered.text, /^Hi Sam,/);
    assert.match(rendered.text, new RegExp(WG_COPY));
    assert.doesNotMatch(rendered.text, /begin settling in/);
  });

  it("Standard customer + self-setup: settling-in copy without claiming White Glove", () => {
    const rendered = renderWelcomeBack({
      firstName: "Sam",
      venueName: "Cedar Hall",
      onboardingType: "self_guided",
    });
    assert.match(rendered.text, new RegExp(SELF_COPY));
    assert.doesNotMatch(rendered.text, /White Glove onboarding/);
  });

  it("does not claim White Glove when checkout onboarding is absent", () => {
    const rendered = renderWelcomeBack({});
    assert.match(rendered.text, new RegExp(SELF_COPY));
    assert.doesNotMatch(rendered.text, /White Glove onboarding/);
  });
});

describe("enrollment product email routing — Welcome Back only when requested", () => {
  it("passes onboardingType into welcome_back vars and gates send on welcomeBackRequested", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "..", "enrollment.ts"), "utf8");
    assert.match(src, /if \(ctx\.welcomeBackRequested\)/);
    assert.match(src, /templateId: "welcome_back"/);
    assert.match(src, /onboardingType: ctx\.onboardingType/);
  });
});
