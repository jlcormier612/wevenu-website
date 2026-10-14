/**
 * Verify Sales & Availability desktop layout refinements.
 * Sandbox only. No scheduling/hold mutations.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
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
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/availability-layout-refinements";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

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

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");

  const image = await servingImage();
  record(
    "Serving expected SHA",
    image.includes(EXPECTED.slice(0, 12)),
    `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
  );

  // Prefer a Fancy wedding lead with multi space prefs + active hold when available.
  const { data: leads } = await admin
    .from("leads")
    .select("id, first_name, last_name, event_type")
    .eq("venue_id", FANCY)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(40);
  let leadId = leads?.[0]?.id as string | undefined;
  for (const l of leads ?? []) {
    const { count } = await admin
      .from("date_holds")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("lead_id", l.id)
      .eq("status", "active");
    if ((count ?? 0) > 0) {
      leadId = l.id;
      break;
    }
  }
  if (!leadId) throw new Error("No Fancy lead found for layout verify");

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
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1500);

    const sales = page.locator('[data-testid="lead-sales-availability"]');
    await sales.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/sales-availability-1280.png` });

    const prefs = page.locator('[data-testid="space-preference-grid"]');
    const prefCount = await prefs.count();
    if (prefCount > 0) {
      const rows = page.locator('[data-testid^="space-pref-row-"]');
      const n = await rows.count();
      const boxes = await rows.evaluateAll((els: Element[]) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), left: Math.round(r.left), label: (el.textContent || "").trim().slice(0, 40) };
        }),
      );
      const tops = new Set(boxes.map((b) => b.top));
      // At 1280, five wedding checkboxes should share one row when present.
      const oneRow = n >= 5 ? tops.size === 1 : tops.size <= 2;
      record(
        "Space preferences desktop single row",
        oneRow,
        JSON.stringify({ n, tops: [...tops], boxes }),
      );
      await prefs.screenshot({ path: `${OUT}/space-preferences-1280.png` });
    } else {
      record("Space preferences present", false, "grid missing on this lead");
    }

    const place = page.locator('[data-testid="date-hold-place"]');
    const holdCompact = page.locator('[data-testid="date-hold-compact"]');
    if ((await place.count()) && (await holdCompact.count())) {
      const geometry = await page.evaluate(() => {
        const placeEl = document.querySelector('[data-testid="date-hold-place"]') as HTMLElement | null;
        const owner = document.querySelector('[data-testid="lead-staff-assignment"]') as HTMLElement | null;
        const hold = document.querySelector('[data-testid="date-hold-active"]') as HTMLElement | null;
        const row = document.querySelector('[data-testid="lead-owner-hold-row"]') as HTMLElement | null;
        const box = (el: HTMLElement | null) =>
          el
            ? {
                top: Math.round(el.getBoundingClientRect().top),
                left: Math.round(el.getBoundingClientRect().left),
                bottom: Math.round(el.getBoundingClientRect().bottom),
                right: Math.round(el.getBoundingClientRect().right),
              }
            : null;
        return {
          place: box(placeEl),
          owner: box(owner),
          hold: box(hold),
          row: box(row),
          rowOverflow: row ? row.scrollWidth > row.clientWidth + 1 : null,
        };
      });
      const sameBand =
        geometry.place
        && geometry.hold
        && Math.abs(geometry.place.top - geometry.hold.top) < 40;
      record(
        "Place another hold shares hold control band",
        Boolean(sameBand),
        JSON.stringify(geometry),
      );
      record(
        "Owner/hold row no horizontal overflow",
        geometry.rowOverflow === false,
        JSON.stringify({ rowOverflow: geometry.rowOverflow }),
      );
    } else {
      record(
        "Hold place CTA present for geometry check",
        false,
        `place=${await place.count()} compact=${await holdCompact.count()}`,
      );
    }

    // Narrow viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    await sales.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/sales-availability-390.png`, fullPage: false });
    const narrow = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="lead-owner-hold-row"]') as HTMLElement | null;
      const prefs = document.querySelector('[data-testid="space-preference-grid"]') as HTMLElement | null;
      const overflow = (el: HTMLElement | null) =>
        el ? el.scrollWidth > el.clientWidth + 1 : null;
      return {
        rowOverflow: overflow(row),
        prefsOverflow: overflow(prefs),
        bodyOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    });
    record(
      "Narrow viewport no horizontal overflow",
      narrow.rowOverflow === false
        && narrow.prefsOverflow !== true
        && narrow.bodyOverflow === false,
      JSON.stringify(narrow),
    );
  } finally {
    await browser.close();
  }

  const allPass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ expectedSha: EXPECTED, servingImage: image, leadId, allPass, checks, at: new Date().toISOString() }, null, 2),
  );
  console.log(allPass ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
