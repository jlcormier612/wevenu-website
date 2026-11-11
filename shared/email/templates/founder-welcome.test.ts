import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderEmailTemplate } from "@/shared/email/templates/registry";

describe("founder_welcome — Founding Member copy", () => {
  const rendered = renderEmailTemplate("founder_welcome", {
    firstName: "Sally",
    lastName: "Sunshine",
    fullName: "Sally Sunshine",
    venueName: "Sally Sunshine Events",
    planName: "Gather",
    activateUrl:
      "https://workspace.sandbox.hellotocheers.com/activate/tok_sally_test",
  });

  it("greets the subscriber by first name, not Hi there", () => {
    assert.match(rendered.text, /^Hi Sally,/);
    assert.doesNotMatch(rendered.text, /Hi there/);
  });

  it("welcomes the venue separately from the person", () => {
    assert.match(
      rendered.text,
      /Thank you for joining Hello to Cheers as a Founding Member\. We're so excited to welcome Sally Sunshine Events\./,
    );
    assert.doesNotMatch(
      rendered.text,
      /Founding Member for Sally Sunshine[^.]*\./,
    );
  });

  it("keeps the subscription confirmation with the real plan name", () => {
    assert.match(
      rendered.text,
      /Your Gather Founding subscription is confirmed — you're ready to set up your workspace\./,
    );
  });

  it("does not send the customer to public marketing pages", () => {
    assert.doesNotMatch(rendered.text, /Getting started:/);
    assert.doesNotMatch(rendered.text, /Resources & guides:/);
    assert.doesNotMatch(rendered.text, /\/product/);
    assert.doesNotMatch(rendered.text, /\/resources/);
    assert.doesNotMatch(rendered.html, /\/product/);
    assert.doesNotMatch(rendered.html, /\/resources/);
  });

  it("points next steps at the existing activation URL", () => {
    assert.match(rendered.text, /What happens next/);
    assert.match(
      rendered.text,
      /Activate your account, create your password, and we'll walk you through the important pieces of your venue setup, one step at a time\. You can take it at your own pace\./,
    );
    assert.match(
      rendered.text,
      /https:\/\/workspace\.sandbox\.hellotocheers\.com\/activate\/tok_sally_test/,
    );
    assert.match(
      rendered.html,
      /https:\/\/workspace\.sandbox\.hellotocheers\.com\/activate\/tok_sally_test/,
    );
    assert.doesNotMatch(rendered.html, /hellotocheers\.com\/product/);
  });

  it("keeps the reply invitation and Jennifer sign-off", () => {
    assert.match(
      rendered.text,
      /Questions\? Just reply to this email — Jennifer and the team are listening\./,
    );
    assert.match(rendered.html, /With care,/);
    assert.match(rendered.html, /Jennifer &amp; the Hello to Cheers team/);
  });
});
