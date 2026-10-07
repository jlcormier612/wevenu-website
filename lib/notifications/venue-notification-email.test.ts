import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { buildVenueNotificationEmail } from "@/lib/notifications/venue-notification-email";
import { buildMergeData, mergeContent } from "@/lib/message-templates/merge";
import { wrapConversationMessageHtml } from "@/lib/email/conversation-brand";
import { emailBrandFromVenue } from "@/lib/email/venue-brand";

const ORIGIN = "https://app.sandbox.hellotocheers.com";

function visible(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("venue staff notification emails", () => {
  it("new tour scheduled names the appointment and links with a lead CTA", () => {
    const email = buildVenueNotificationEmail({
      title: "New tour scheduled — Nicole Bethune",
      body: "Oct 10, 2026 at 11:30 AM · 60 min · wedding",
      link: "/leads/11111111-1111-1111-1111-111111111111",
      appOrigin: ORIGIN,
    });
    assert.equal(email.subject, "New tour scheduled — Nicole Bethune");
    assert.match(email.text, /Oct 10, 2026 at 11:30 AM · 60 min · wedding/);
    assert.equal(email.ctaLabel, "View Nicole's lead");
    assert.equal(email.href, `${ORIGIN}/leads/11111111-1111-1111-1111-111111111111`);
    assert.match(email.html, /hello-to-cheers-logo-primary-transparent/);
    assert.match(email.html, /View Nicole&#39;s lead|View Nicole's lead/);
    assert.match(email.html, /Oct 10, 2026 at 11:30 AM/);
    assert.doesNotMatch(visible(email.html), /https?:\/\//);
    assert.match(email.html, new RegExp(`href="${ORIGIN}/leads/11111111-1111-1111-1111-111111111111"`));
  });

  it("new inquiry keeps the inquiry line and uses the same lead CTA", () => {
    const email = buildVenueNotificationEmail({
      title: "New inquiry from Nicole Bethune",
      body: "wedding · May 09, 2027",
      link: "/leads/22222222-2222-2222-2222-222222222222",
      appOrigin: ORIGIN,
    });
    assert.equal(email.subject, "New inquiry from Nicole Bethune");
    assert.match(email.text, /wedding · May 09, 2027/);
    assert.equal(email.ctaLabel, "View Nicole's lead");
    assert.match(email.html, /wedding · May 09, 2027/);
    assert.doesNotMatch(visible(email.html), /https?:\/\//);
    assert.match(email.html, /hello-to-cheers-logo-primary-transparent/);
  });

  it("the dispatcher sends that HTML instead of a bare URL body", () => {
    const src = readFileSync(resolve("lib/notifications/obligation-engine.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function processVenueNotificationEmails"));
    assert.match(fn, /buildVenueNotificationEmail/);
    assert.match(fn, /html: email\.html/);
    assert.doesNotMatch(fn, /\$\{baseUrl\}\$\{row\.link\}/);
  });
});

describe("customer inquiry response sign-off", () => {
  it("prints the venue name once when the coordinator would only repeat it", () => {
    const template = [
      "Hi {{first_name}},",
      "",
      "Thank you for reaching out to {{venue_name}}.",
      "",
      "Warmly,",
      "{{coordinator_name}}",
      "{{venue_name}}",
    ].join("\n");
    const body = mergeContent(template, buildMergeData({
      venueName: "Lulu Lodge",
      clientName: "Nicole Bethune",
      clientFirstName: "Nicole",
      coordinatorName: "Lulu Lodge",
      eventDate: "2027-05-09",
    }));
    const signoff = body.slice(body.indexOf("Warmly,"));
    assert.match(signoff, /Warmly,\n\nLulu Lodge$/);
    assert.equal((signoff.match(/Lulu Lodge/g) ?? []).length, 1);
    const brand = emailBrandFromVenue({
      name: "Lulu Lodge",
      logo_url: "https://cdn.example.test/lulu-logo.png",
      primary_color: "#5D6F5D",
      email_signature: "Cheers!\nThe Lulu Lodge Crew",
    });
    const html = wrapConversationMessageHtml(brand, body);
    assert.match(html, /cdn\.example\.test\/lulu-logo\.png/);
    assert.match(html, /Cheers!/);
    assert.match(html, /The Lulu Lodge Crew/);
    assert.doesNotMatch(html, /Lulu Lodge<br>Lulu Lodge/);
    assert.doesNotMatch(html, />Lulu Lodge<\/p>\s*<p[^>]*>Lulu Lodge</);
  });

  it("keeps a real coordinator and the venue on separate sign-off lines", () => {
    const template = ["Warmly,", "{{coordinator_name}}", "{{venue_name}}"].join("\n");
    const body = mergeContent(template, buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientName: "Betty Rubble",
      coordinatorName: "Jennifer Fancy, Owner",
      eventDate: null,
    }));
    assert.match(body, /Warmly,\nJennifer Fancy, Owner\nJen's Fancy Venue$/);
  });

  it("merge context does not substitute the venue name for a missing owner", () => {
    const src = readFileSync(resolve("lib/scheduled-messages/repository.ts"), "utf8");
    const fn = src.slice(src.indexOf("const coordinatorName"));
    assert.doesNotMatch(fn.slice(0, 250), /venue\?\.name/);
  });
});
