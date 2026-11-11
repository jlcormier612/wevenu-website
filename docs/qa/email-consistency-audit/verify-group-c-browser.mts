/**
 * Group C Sandbox verify — no sends.
 * Serving SHA + accept-participant destination + D5 render against helpers.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

import { buildPortalParticipantInviteEmail } from "../../../lib/portal/participant-invite-email.ts";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const OUT = "docs/qa/email-consistency-audit";
const ACCEPT = `${APP}/client/accept-participant?token=verify_only_not_a_real_invite`;

if (!EXPECTED) throw new Error("EXPECTED_SHA required");

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

const email = buildPortalParticipantInviteEmail({
  firstName: "Sam",
  coupleName: "Alex & Jordan",
  venueName: "Jen's Fancy Venue",
  acceptUrl: ACCEPT,
  brandSource: {
    name: "Jen's Fancy Venue",
    logoUrl: "https://cdn.example.test/venues/fancy-logo.png",
    primaryColor: "#8B4513",
  },
});
record(
  "D5 venue shell + CTA",
  /border-top:4px solid #8B4513/.test(email.html) &&
    /Create Your Account/.test(email.html) &&
    email.html.includes(ACCEPT) &&
    email.text.includes(ACCEPT),
  email.subject,
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(ACCEPT, { waitUntil: "networkidle", timeout: 90_000 });
const body = await page.locator("body").innerText().catch(() => "");
// Invalid token should still land on the accept route (not login redirect away from client).
const onAccept =
  page.url().includes("/client/accept-participant") ||
  /accept|invitation|invalid|expired|token/i.test(body);
record("Accept-participant destination reachable", onAccept, `url=${page.url()}`);
await page.screenshot({ path: `${OUT}/group-c-accept-participant-1280.png`, fullPage: false });
await browser.close();

const allPass = checks.every((c) => c.pass);
const results = {
  at: new Date().toISOString(),
  expectedSha: EXPECTED,
  servingImage: image,
  checks,
  allPass,
  noSends: true,
};
writeFileSync(`${OUT}/group-c-browser-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ allPass }, null, 2));
if (!allPass) process.exit(1);
