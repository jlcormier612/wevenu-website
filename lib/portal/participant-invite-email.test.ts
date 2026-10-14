import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { buildPortalParticipantInviteEmail } from "@/lib/portal/participant-invite-email";

const ACCEPT =
  "https://app.sandbox.hellotocheers.com/client/accept-participant?token=invite_tok_abc";

function visible(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("portal participant invite email (D5 / #28)", () => {
  it("uses the venue-branded shell, clear context, and accept CTA", () => {
    const email = buildPortalParticipantInviteEmail({
      firstName: "Sam",
      coupleName: "Alex & Jordan",
      venueName: "Jen's Fancy Venue",
      acceptUrl: ACCEPT,
      brandSource: {
        name: "Jen's Fancy Venue",
        logoUrl: "https://cdn.example.test/venues/fancy-logo.png",
        primaryColor: "#8B4513",
        email: "hello@fancy.test",
        emailSignature: "Warmly,\nJen's Fancy Venue",
      },
    });

    assert.equal(email.subject, "Alex & Jordan invited you to their planning workspace");
    assert.match(email.text, /Hi Sam,/);
    assert.match(email.text, /Alex & Jordan invited you to help plan their celebration with Jen's Fancy Venue/);
    assert.match(email.text, /Terms and Privacy Policy/);
    assert.ok(email.text.includes(ACCEPT));
    assert.match(email.text, /personal to you/);

    assert.match(email.html, /border-top:4px solid #8B4513/);
    assert.match(email.html, /cdn\.example\.test\/venues\/fancy-logo\.png/);
    assert.match(email.html, /Create Your Account/);
    assert.match(email.html, new RegExp(`href="${ACCEPT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.match(email.html, /Alex &amp; Jordan/);
    assert.match(email.html, /invited you to help plan their celebration/);
    assert.match(visible(email.html), /Jen's Fancy Venue/);
    assert.doesNotMatch(email.html, /hello-to-cheers-logo/);
    assert.doesNotMatch(visible(email.html), /internal note|coordinator only/i);
  });

  it("keeps HTML/text essential parity without logo when venue has none", () => {
    const email = buildPortalParticipantInviteEmail({
      firstName: "Pat",
      coupleName: "Riley",
      venueName: "No Logo Venue",
      acceptUrl: ACCEPT,
      brandSource: {
        name: "No Logo Venue",
        logoUrl: null,
        primaryColor: "#5D6F5D",
      },
    });
    assert.match(email.html, /border-top:4px solid #5D6F5D/);
    assert.doesNotMatch(email.html, /<img /);
    assert.match(email.text, /Riley invited you to help plan their celebration with No Logo Venue/);
    assert.ok(email.text.includes(ACCEPT));
  });

  it("POST /api/portal/participants sends the branded builder output", () => {
    const src = readFileSync(resolve("app/api/portal/participants/route.ts"), "utf8");
    assert.match(src, /buildPortalParticipantInviteEmail/);
    assert.match(src, /html:\s*emailBodies\.html/);
    assert.doesNotMatch(src, /style="background:\$\{venueColor\}/);
  });
});
