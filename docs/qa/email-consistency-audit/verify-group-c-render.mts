/**
 * Group C D5 — deterministic participant-invite render (no sends).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

import { buildPortalParticipantInviteEmail } from "../../../lib/portal/participant-invite-email.ts";

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

const OUT = "docs/qa/email-consistency-audit";
const ACCEPT =
  "https://app.sandbox.hellotocheers.com/client/accept-participant?token=fixture_participant_tok";

mkdirSync(OUT, { recursive: true });

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
  },
});

writeFileSync(`${OUT}/group-c-participant-invite.html`, email.html);
writeFileSync(`${OUT}/group-c-participant-invite.txt`, email.text);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`file://${process.cwd()}/${OUT}/group-c-participant-invite.html`);
await page.screenshot({ path: `${OUT}/group-c-participant-invite-1280.png`, fullPage: true });
await page.setViewportSize({ width: 390, height: 900 });
await page.screenshot({ path: `${OUT}/group-c-participant-invite-390.png`, fullPage: true });
await browser.close();

const checks = {
  subject: email.subject === "Alex & Jordan invited you to their planning workspace",
  venueShell: /border-top:4px solid #8B4513/.test(email.html),
  cta: /Create Your Account/.test(email.html) && email.html.includes(ACCEPT),
  textParity: email.text.includes(ACCEPT) && /Alex & Jordan invited you/.test(email.text),
  noHtcLogo: !/hello-to-cheers-logo-primary-transparent/.test(email.html),
  noInternal: !/internal note/i.test(email.html + email.text),
};

const results = {
  at: new Date().toISOString(),
  checks,
  allPass: Object.values(checks).every(Boolean),
};
writeFileSync(`${OUT}/group-c-render-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (!results.allPass) process.exit(1);
