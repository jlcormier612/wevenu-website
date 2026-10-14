/**
 * Website-form venue inquiry notification must use the shared HTC-branded
 * staff email shell (logo + green CTA), not a plain-text body with a raw URL.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { buildVenueNotificationEmail } from "@/lib/notifications/venue-notification-email";
import { HTC_EMAIL_CTA_BACKGROUND } from "@/lib/email/htc-cta";

const ORIGIN = "https://app.sandbox.hellotocheers.com";

function visible(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("public inquire venue notification branding", () => {
  it("inquire route builds branded HTML via buildVenueNotificationEmail", () => {
    const route = readFileSync(resolve("app/api/public/inquire/route.ts"), "utf8");
    assert.match(route, /buildVenueNotificationEmail/);
    assert.match(route, /html:\s*venueEmail\.html/);
    assert.match(route, /New inquiry from \$\{inquirerName\}/);
    assert.match(route, /\/leads\/\$\{outcome\.leadId\}/);
    assert.doesNotMatch(route, /View in Hello to Cheers: \$\{process\.env\.NEXT_PUBLIC_APP_URL/);
    assert.doesNotMatch(route, /subject: `New inquiry: \$\{inquirerName\}`/);
  });

  it("website-form inquiry body keeps details and uses lead CTA without a visible raw URL", () => {
    const email = buildVenueNotificationEmail({
      title: "New inquiry from Alice GateBOne",
      body: [
        "New inquiry received via Meadowbrook Valley Venue's website form.",
        "",
        "Name: Alice GateBOne",
        "Email: alice@example.com",
        "Phone: 5551001001",
        "Event type: Wedding",
        "Preferred event date: 2027-11-11",
      ].join("\n"),
      link: "/leads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      appOrigin: ORIGIN,
    });
    assert.equal(email.subject, "New inquiry from Alice GateBOne");
    assert.equal(email.ctaLabel, "View Alice's lead");
    assert.match(email.html, /hello-to-cheers-logo-primary-transparent/);
    assert.match(email.html, new RegExp(`background:${HTC_EMAIL_CTA_BACKGROUND}`));
    assert.match(email.html, /New inquiry received via Meadowbrook Valley Venue/);
    assert.match(email.html, /Event type: Wedding/);
    assert.doesNotMatch(email.html, /Event type: wedding\b/);
    assert.match(email.html, /Preferred event date: 2027-11-11/);
    assert.doesNotMatch(visible(email.html), /https?:\/\//);
    assert.match(
      email.html,
      new RegExp(`href="${ORIGIN}/leads/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"`),
    );
  });
});
