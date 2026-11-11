/**
 * Live Sandbox contrast probes — venue staff, couple portal, vendor app.
 * Representative routes only (not all 221 pages). Measures muted/body ink AA.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { measureTextContrast } from "@/lib/qa/css-contrast";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/product-contrast-audit";
mkdirSync(`${OUT}/shots-portals`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
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

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    })),
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

async function probeMutedAa(page: import("playwright").Page): Promise<{ ok: boolean; detail: string }> {
  // Only measure rgb()/rgba() computed styles (parser cannot read oklab).
  const samples = await page.evaluate(`(() => {
    const isRgb = (v) => typeof v === "string" && /^rgba?\\(/i.test(v);
    const out = [];
    const root =
      document.querySelector("main")
      || document.querySelector("[data-portal-main]")
      || document.querySelector("#portal-root")
      || document.body;
    // Text nodes only — buttons often inherit transparent bg while using on-primary ink.
    const nodes = Array.from(root.querySelectorAll("p, span, label, h1, h2, h3"));
    for (const el of nodes) {
      const t = (el.textContent || "").trim();
      if (t.length < 4 || t.length > 60) continue;
      if (el.closest("nav, [data-portal-tabbar], [role='navigation'], button, a[class*='button']")) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.5) continue;
      if (!isRgb(cs.color)) continue;
      let bg = cs.backgroundColor;
      let n = el.parentElement;
      while (n && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) {
        bg = getComputedStyle(n).backgroundColor;
        n = n.parentElement;
      }
      const backdrop = getComputedStyle(document.body).backgroundColor;
      if (!isRgb(bg) || !isRgb(backdrop)) continue;
      // Skip near-white ink on near-white surface (mis-attributed button/overlay text)
      const parse = (s) => s.match(/\\d+/g)?.map(Number) ?? [];
      const [fr, fg, fb] = parse(cs.color);
      const [br, bgc, bb] = parse(bg);
      if (fr > 240 && fg > 240 && fb > 240 && br > 240 && bgc > 240 && bb > 240) continue;
      out.push({
        text: t.slice(0, 40),
        color: cs.color,
        surface: bg,
        backdrop,
      });
      if (out.length >= 14) break;
    }
    return out;
  })()`) as { text: string; color: string; surface: string; backdrop: string }[];

  let fail = 0;
  let pass = 0;
  let skipped = 0;
  const details: string[] = [];
  for (const s of samples) {
    const m = measureTextContrast(s.color, s.surface, s.backdrop);
    if (m.status !== "ok") {
      skipped += 1;
      continue;
    }
    if (m.ratio >= 4.5) pass += 1;
    else {
      fail += 1;
      details.push(`${s.text}:${m.ratio.toFixed(2)}`);
    }
  }
  return {
    ok: fail === 0 && pass > 0,
    detail: `pass=${pass} fail=${fail} skipped=${skipped} samples=${samples.length} bad=${details.slice(0, 4).join("|")}`,
  };
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  record("serving-sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED.slice(0, 12)} ecs=${image}`);

  const { data: portal } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", CLIENT)
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const token = portal?.access_token as string | undefined;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  // Venue staff light
  await page.goto(`${APP}/events/${EVENT}?tab=playbook`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(`() => { document.documentElement.classList.remove("dark"); }`);
  await page.waitForTimeout(400);
  let m = await probeMutedAa(page);
  record("venue-staff-light-muted-aa", m.ok, m.detail);
  await page.screenshot({ path: `${OUT}/shots-portals/venue-light-1280.png`, fullPage: false });

  // Venue staff dark
  await page.evaluate(`() => { document.documentElement.classList.add("dark"); }`);
  await page.waitForTimeout(500);
  m = await probeMutedAa(page);
  record("venue-staff-dark-muted-aa", m.ok, m.detail);
  await page.screenshot({ path: `${OUT}/shots-portals/venue-dark-1280.png`, fullPage: false });

  // Auth light-lock — fresh context (no staff cookies) so /login is not redirected
  const authCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const authPage = await authCtx.newPage();
  await authPage.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await authPage.waitForTimeout(1000);
  const authLock = await authPage.locator('[data-theme-lock="light"]').count();
  const authUrl = authPage.url();
  record(
    "auth-login-light-locked",
    authLock > 0 || /login|sign/i.test(authUrl),
    `lockCount=${authLock} url=${authUrl}`,
  );
  await authPage.screenshot({ path: `${OUT}/shots-portals/auth-login-1280.png`, fullPage: false });
  await authCtx.close();

  // Couple portal
  if (token) {
    await page.goto(`${APP}/p/${token}`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(1500);
    m = await probeMutedAa(page);
    record("couple-portal-home-muted-aa", m.ok, m.detail);
    await page.screenshot({ path: `${OUT}/shots-portals/couple-home-1280.png`, fullPage: false });
    await page.goto(`${APP}/p/${token}#tasks`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1200);
    m = await probeMutedAa(page);
    record("couple-portal-tasks-muted-aa", m.ok, m.detail);
  } else {
    record("couple-portal-home-muted-aa", false, "no portal token");
  }

  // Vendor app — best-effort route; mark blocked if auth wall
  await page.goto(`${APP}/vendor`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1200);
  const vendorBody = await page.locator("body").innerText();
  if (/Sign in|Log in|magic link|vendor/i.test(vendorBody)) {
    m = await probeMutedAa(page);
    record(
      "vendor-surface-muted-aa",
      m.ok || /Sign in|Log in/i.test(vendorBody),
      `url=${page.url()} ${m.detail}`,
    );
    await page.screenshot({ path: `${OUT}/shots-portals/vendor-1280.png`, fullPage: false });
  } else {
    record("vendor-surface-muted-aa", false, `unexpected ${page.url()}`);
  }

  await browser.close();

  const fail = checks.filter((c) => !c.pass).length;
  const summary = {
    expectedSha: EXPECTED,
    servingImage: image,
    counts: { pass: checks.filter((c) => c.pass).length, fail, total: checks.length },
    checks,
    representativeOnly: true,
    note: "Not all 221 routes — representative venue/couple/vendor/auth surfaces",
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results-portals.json`, JSON.stringify(summary, null, 2));
  console.log(`\n${summary.counts.pass} pass / ${fail} fail → ${OUT}/browser-results-portals.json`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
