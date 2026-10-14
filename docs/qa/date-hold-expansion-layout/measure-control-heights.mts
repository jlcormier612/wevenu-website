/**
 * Measure Sales & Availability control heights vs platform references on Sandbox.
 * Read-only — does not create holds.
 */
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const LEAD_ID = "e0172773-b908-4970-979a-b53029a40ca9";
const OUT = "docs/qa/date-hold-expansion-layout";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

async function cookiesFor() {
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
  return [
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
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor());
  const page = await context.newPage();
  await page.goto(`${APP}/leads/${LEAD_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector('[data-testid="lead-owner-hold-row"]', { timeout: 30000 });

  const measurements = await page.evaluate(`(() => {
    function box(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        h: Math.round(r.height * 10) / 10,
        w: Math.round(r.width * 10) / 10,
        fontSize: cs.fontSize,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        borderRadius: cs.borderRadius,
        tag: el.tagName.toLowerCase(),
        testId: el.getAttribute("data-testid"),
        text: (el.textContent || "").trim().slice(0, 40),
      };
    }
    const row = document.querySelector('[data-testid="lead-owner-hold-row"]');
    const owner = document.querySelector('[data-testid="lead-owner-assignment"]');
    const ownerTrigger = owner?.querySelector('[data-slot="select-trigger"], button[aria-label="Sales owner"], [role="combobox"]');
    const ownerSave = document.querySelector('[data-testid="lead-owner-assignment-save"]');
    const place = document.querySelector('[data-testid="date-hold-place"]');
    // Platform references on same lead page
    const scheduleTour = document.querySelector('[data-testid="schedule-tour-action"]');
    const relEmail = document.querySelector('[data-testid="relationship-email"], button[data-testid*="email"]');
    const statusBtn = document.querySelector('[data-testid="lead-status-trigger"], button:has(span)');
    // Find outline/sm buttons in relationship / tour area
    const tourSchedule = scheduleTour;
    const headerActions = Array.from(document.querySelectorAll('button')).filter((b) => {
      const t = (b.textContent || "").trim();
      return /^(Edit|Save|Schedule|Email|Call|Notes)/i.test(t) || t.includes("Schedule");
    }).slice(0, 12).map(box);
    return {
      ownerTrigger: box(ownerTrigger),
      ownerSave: box(ownerSave),
      placeHold: box(place),
      scheduleTour: box(tourSchedule),
      sampleButtons: headerActions,
      rowHeight: row ? Math.round(row.getBoundingClientRect().height * 10) / 10 : null,
    };
  })()`);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/control-height-baseline.json`, JSON.stringify(measurements, null, 2));
  console.log(JSON.stringify(measurements, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
