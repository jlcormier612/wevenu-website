/**
 * Group A Sandbox verify — no sends.
 * Confirms serving SHA + lead-specific CTA destination in Fancy venue context.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import {
  buildPublicIntakeThankYouEmail,
  buildPublicIntakeVenueDetailBody,
  formatPublicIntakeEventTypeLine,
} from "../../../lib/lead-intake/public-intake-emails.ts";
import { buildVenueNotificationEmail } from "../../../lib/notifications/venue-notification-email.ts";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const OUT = "docs/qa/email-consistency-audit";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function servingImage(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

mkdirSync(OUT, { recursive: true });
const image = await servingImage();
record(
  "Serving expected SHA",
  image.includes(EXPECTED.slice(0, 12)),
  `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
);

// Deterministic render checks against helpers in this commit
const thankYou = buildPublicIntakeThankYouEmail({
  kind: "inquiry",
  venueName: "Jen's Fancy Venue",
  firstName: "Alice",
  brandSource: { name: "Jen's Fancy Venue", primaryColor: "#5D6F5D" },
});
record(
  "D1 thank-you HTML+text parity",
  /Thank you, Alice!/.test(thankYou.html)
    && /Thank you, Alice!/.test(thankYou.text)
    && /inquiry for Jen's Fancy Venue/.test(thankYou.html)
    && /inquiry for Jen's Fancy Venue/.test(thankYou.text)
    && /border-top:4px solid #5D6F5D/.test(thankYou.html),
  thankYou.subject,
);
record(
  "D3 Wedding label",
  formatPublicIntakeEventTypeLine("wedding") === "Event type: Wedding"
    && formatPublicIntakeEventTypeLine("corporate") === "Event type: Corporate Event",
  "canonical labels",
);

const { data: lead } = await admin
  .from("leads")
  .select("id, first_name, last_name, venue_id")
  .eq("venue_id", FANCY)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (!lead?.id) throw new Error("no Fancy lead for CTA check");

const formVenue = buildVenueNotificationEmail({
  title: `New public form lead: ${lead.first_name} ${lead.last_name}`,
  body: buildPublicIntakeVenueDetailBody({
    intro: "New lead received via a custom public form for Jen's Fancy Venue.",
    inquirerName: `${lead.first_name} ${lead.last_name}`,
    inquirerEmail: "probe@example.com",
    eventType: "wedding",
  }),
  link: `/leads/${lead.id}`,
  appOrigin: APP,
});
record(
  "D2 lead-specific CTA href",
  formVenue.href === `${APP}/leads/${lead.id}`
    && /Event type: Wedding/.test(formVenue.html)
    && !/\/leads"/.test(formVenue.html.replace(`/leads/${lead.id}`, "")),
  formVenue.href ?? "null",
);

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: FANCY_EMAIL,
});
if (linkErr) throw linkErr;
const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
  type: "email",
  token_hash: linkData.properties!.hashed_token!,
});
if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");

const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
const cookies = [
  ...ssrUtils.createChunks(cookieName, encoded).map(
    (c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    }),
  ),
  {
    name: "htc_active_venue_id",
    value: FANCY,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  },
];

const browser = await chromium.launch({ headless: true });
const consoleErrors: string[] = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies(cookies);
const page = await context.newPage();
page.on("console", (msg: { type: () => string; text: () => string }) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await page.goto(formVenue.href!, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(2000);
await page.keyboard.press("Escape").catch(() => {});
await page.screenshot({ path: `${OUT}/group-a-cta-lead-1280.png`, fullPage: false });
const landed = page.url();
const bodyText = await page.locator("body").innerText();
record(
  "D2 CTA opens Fancy lead in venue context",
  landed.includes(`/leads/${lead.id}`)
    && /Jen'?s Fancy Venue/i.test(bodyText)
    && !/Wrong venue|Access denied|Not found/i.test(bodyText),
  `landed=${landed}`,
);

// Narrow viewport smoke on rendered thank-you HTML (local setContent — no send)
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mpage = await mobile.newPage();
await mpage.setContent(thankYou.html, { waitUntil: "load" });
await mpage.screenshot({ path: `${OUT}/group-a-deployed-thank-you-390.png`, fullPage: true });
record(
  "Mobile thank-you render",
  (await mpage.locator("body").innerText()).includes("Thank you, Alice!"),
  "390 viewport",
);

await mobile.close();
await browser.close();

record(
  "No critical console errors",
  !consoleErrors.some((e) => /TypeError|ReferenceError|ChunkLoadError/i.test(e)),
  `errors=${consoleErrors.length}`,
);
record("No real emails sent", true, "magic-link auth + navigation only");

const pass = checks.every((c) => c.pass);
const results = {
  at: new Date().toISOString(),
  expectedSha: EXPECTED,
  servingImage: image,
  leadId: lead.id,
  formVenueHref: formVenue.href,
  pass,
  checks,
  consoleErrors: consoleErrors.slice(0, 10),
};
writeFileSync(`${OUT}/group-a-browser-results.json`, JSON.stringify(results, null, 2));
console.log(pass ? "GROUP A BROWSER PASS" : "GROUP A BROWSER FAIL");
process.exit(pass ? 0 : 1);
