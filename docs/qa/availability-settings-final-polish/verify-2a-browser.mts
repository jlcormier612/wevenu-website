/**
 * Queue Item 2A — Sales & Availability polish verification.
 * Sandbox only. No hold mutations.
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
const OUT = "docs/qa/availability-settings-final-polish";

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

  const { data: activeHolds } = await admin
    .from("date_holds")
    .select("lead_id")
    .eq("venue_id", FANCY)
    .eq("status", "active")
    .not("lead_id", "is", null)
    .limit(20);
  let leadId = (activeHolds?.[0]?.lead_id as string | undefined) ?? undefined;
  if (!leadId) {
    const { data: leads } = await admin
      .from("leads")
      .select("id")
      .eq("venue_id", FANCY)
      .order("updated_at", { ascending: false })
      .limit(5);
    leadId = leads?.[0]?.id;
  }
  if (!leadId) throw new Error("No Fancy lead");

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

  const shot1280 = process.env.SHOT_SUFFIX
    ? `${OUT}/sales-availability-1280-${process.env.SHOT_SUFFIX}.png`
    : `${OUT}/sales-availability-1280.png`;
  const shot390 = process.env.SHOT_SUFFIX
    ? `${OUT}/sales-availability-390-${process.env.SHOT_SUFFIX}.png`
    : `${OUT}/sales-availability-390.png`;
  const resultsName = process.env.SHOT_SUFFIX
    ? `${OUT}/browser-results-${process.env.SHOT_SUFFIX}.json`
    : `${OUT}/browser-results.json`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/leads/${leadId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForSelector('[data-testid="lead-sales-availability"]', {
      timeout: 45000,
    });
    await page.locator('[data-testid="lead-sales-availability"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: shot1280 });

    const metrics = await page.evaluate(`(() => {
      const styleOf = (el) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          text: (el.textContent || "").trim().slice(0, 40),
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          color: cs.color,
          height: Math.round(r.height),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
        };
      };
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          height: Math.round(r.height),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          left: Math.round(r.left),
          bg: cs.backgroundColor,
          color: cs.color,
          border: cs.borderTopColor,
          classes: el.className,
        };
      };

      const ownerLabel = document.querySelector(
        '[data-testid="lead-staff-assignment"] > span',
      );
      const holdLabel = Array.from(
        document.querySelectorAll('[data-testid="date-hold-compact"] > span'),
      ).find((el) => (el.textContent || "").trim() === "Date hold");
      const ownerSelect = document.querySelector(
        '[data-testid="lead-staff-assignment"] [data-slot="select-trigger"], [data-testid="lead-staff-assignment"] button[role="combobox"]',
      );
      const ownerTrigger =
        ownerSelect ||
        document.querySelector('[data-testid="lead-staff-assignment"] button');
      const ownerSave = document.querySelector(
        '[data-testid="lead-staff-assignment-save"]',
      );
      const holdChip = document.querySelector('[data-testid="date-hold-active"]');
      const place = document.querySelector('[data-testid="date-hold-place"]');

      return {
        ownerLabel: styleOf(ownerLabel),
        holdLabel: styleOf(holdLabel || null),
        ownerTrigger: box(ownerTrigger),
        ownerSave: box(ownerSave),
        holdChip: box(holdChip),
        place: box(place),
        placeText: place ? (place.textContent || "").trim() : null,
      };
    })()`);

    // A — labels
    const labelsMatch =
      metrics.ownerLabel &&
      metrics.holdLabel &&
      metrics.ownerLabel.fontSize === metrics.holdLabel.fontSize &&
      metrics.ownerLabel.fontWeight === metrics.holdLabel.fontWeight &&
      metrics.ownerLabel.color === metrics.holdLabel.color &&
      Math.abs(metrics.ownerLabel.height - metrics.holdLabel.height) <= 2;
    record("A labels font/height match", Boolean(labelsMatch), JSON.stringify({
      owner: metrics.ownerLabel,
      hold: metrics.holdLabel,
    }));

    // B — control heights (select vs hold chip)
    const heightsOk =
      metrics.ownerTrigger &&
      metrics.holdChip &&
      Math.abs(metrics.ownerTrigger.height - metrics.holdChip.height) <= 6;
    const topsOk =
      metrics.ownerTrigger &&
      metrics.holdChip &&
      Math.abs(metrics.ownerTrigger.top - metrics.holdChip.top) <= 8;
    record("B select vs hold chip height", Boolean(heightsOk), JSON.stringify({
      ownerTrigger: metrics.ownerTrigger,
      holdChip: metrics.holdChip,
    }));
    record("B select vs hold chip top align", Boolean(topsOk), JSON.stringify({
      ownerTop: metrics.ownerTrigger?.top,
      holdTop: metrics.holdChip?.top,
    }));

    // C — Place another hold primary filled (not outline)
    // Primary buttons use solid primary bg; outline uses transparent/muted.
    const placePrimary =
      metrics.place &&
      metrics.ownerSave &&
      // Compare luminance-ish: primary save and place should share similar bg
      metrics.place.bg === metrics.ownerSave.bg &&
      metrics.place.color === metrics.ownerSave.color;
    // Also fail if place looks outline (transparent-ish bg)
    const placeLooksFilled =
      metrics.place &&
      !String(metrics.place.bg).includes("0, 0, 0, 0") &&
      metrics.place.bg !== "rgba(0, 0, 0, 0)";
    record(
      "C Place CTA matches Edit/Save primary fill",
      Boolean(placePrimary && placeLooksFilled),
      JSON.stringify({
        place: metrics.place,
        ownerSave: metrics.ownerSave,
        placeText: metrics.placeText,
      }),
    );

    // Narrow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.locator('[data-testid="lead-sales-availability"]').scrollIntoViewIfNeeded();
    // Smoke: Place opens form; Cancel closes without persisting a hold.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(400);
    await page.locator('[data-testid="lead-sales-availability"]').scrollIntoViewIfNeeded();
    const placeBtn = page.locator('[data-testid="date-hold-place"]');
    if ((await placeBtn.count()) > 0) {
      await placeBtn.click();
      await page.waitForTimeout(400);
      const formOpen = await page.locator('[data-testid="date-hold-place-submit"]').count();
      record("Place CTA opens hold form", formOpen === 1, `submitCount=${formOpen}`);
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.waitForTimeout(300);
      const formClosed = await page.locator('[data-testid="date-hold-place-submit"]').count();
      const placeBack = await page.locator('[data-testid="date-hold-place"]').count();
      record(
        "Cancel closes form without submit",
        formClosed === 0 && placeBack === 1,
        JSON.stringify({ formClosed, placeBack }),
      );
    } else {
      record("Place CTA present for action smoke", false, "missing date-hold-place");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.locator('[data-testid="lead-sales-availability"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: shot390 });
    const narrow = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="lead-owner-hold-row"]');
      return {
        overflow: row ? row.scrollWidth > row.clientWidth + 1 : null,
        bodyOverflow:
          document.documentElement.scrollWidth > window.innerWidth + 2,
      };
    });
    record(
      "Narrow no horizontal overflow",
      narrow.overflow === false && narrow.bodyOverflow === false,
      JSON.stringify(narrow),
    );
  } finally {
    await browser.close();
  }

  const allPass = checks.every((c) => c.pass);
  writeFileSync(
    resultsName,
    JSON.stringify(
      {
        expectedSha: EXPECTED,
        servingImage: image,
        leadId,
        allPass,
        checks,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(allPass ? "ALL PASS" : "SOME FAILED");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
