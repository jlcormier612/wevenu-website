import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildStripeCompleteSetupReturnUrls } from "@/lib/stripe/complete-setup";

describe("buildStripeCompleteSetupReturnUrls", () => {
  it("builds settings return and refresh URLs with stripe_setup markers", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    try {
      const urls = buildStripeCompleteSetupReturnUrls("settings");
      assert.equal(
        urls.returnUrl,
        "https://app.sandbox.hellotocheers.com/settings/integrations?stripe_setup=returned",
      );
      assert.equal(
        urls.refreshUrl,
        "https://app.sandbox.hellotocheers.com/settings/integrations?stripe_setup=refresh",
      );
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });

  it("builds onboarding return URLs under setup-hub financials", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";
    try {
      const urls = buildStripeCompleteSetupReturnUrls("onboarding");
      assert.equal(
        urls.returnUrl,
        "https://app.sandbox.hellotocheers.com/setup-hub/financials?stripe_setup=returned",
      );
      assert.equal(
        urls.refreshUrl,
        "https://app.sandbox.hellotocheers.com/setup-hub/financials?stripe_setup=refresh",
      );
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });
});

describe("Complete Stripe Setup product surface", () => {
  it("incomplete connected state exposes Complete Stripe Setup CTA and keeps Disconnect", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve("components/settings/stripe-connect-section.tsx"), "utf8");
    assert.match(source, /Complete Stripe Setup/);
    assert.match(source, /createCompleteStripeSetupLinkAction/);
    assert.match(source, /refreshStripeChargesEnabledAction/);
    assert.match(source, /Disconnect Stripe/);
    assert.match(source, /Connected, setup incomplete/);
    assert.match(source, /You&apos;re almost there!/);
    assert.match(
      source,
      /Online payments will become available once Stripe confirms your account is eligible\./,
    );
    assert.match(source, /stripe_setup/);
  });

  it("online payments readiness still requires stripe_charges_enabled true", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const route = readFileSync(resolve("app/api/portal/payments/route.ts"), "utf8");
    assert.match(route, /stripe_charges_enabled === true/);
  });
});
