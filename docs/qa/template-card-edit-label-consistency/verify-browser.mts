/**
 * Browser acceptance: template-card Edit labels (not "Edit activities") on Sandbox.
 * EXPECTED_SHA=<serving> npx tsx docs/qa/template-card-edit-label-consistency/verify-browser.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/template-card-edit-label-consistency";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 350)}`);
}

async function servingImage() {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function staffCookies() {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 45_000);
      const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "magiclink", email: EMAIL }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`generate_link HTTP ${res.status}`);
      const body = await res.json() as { hashed_token?: string; properties?: { hashed_token?: string } };
      const hash = body.hashed_token ?? body.properties?.hashed_token;
      if (!hash) throw new Error("missing hashed_token");
      const { data: otp, error } = await anon.auth.verifyOtp({ type: "email", token_hash: hash });
      if (!error && otp?.session) {
        const projectRef = new URL(url).hostname.split(".")[0];
        const cookieName = `sb-${projectRef}-auth-token`;
        const chunked = ssrUtils.createChunks(cookieName, JSON.stringify(otp.session));
        return (Array.isArray(chunked) ? chunked : [{ name: cookieName, value: chunked }]).map(
          (c: { name: string; value: string }) => ({
            name: c.name,
            value: c.value,
            domain: "app.sandbox.hellotocheers.com",
            path: "/",
            httpOnly: false,
            secure: true,
            sameSite: "Lax" as const,
          }),
        );
      }
      lastErr = error ?? new Error("no session");
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw lastErr ?? new Error("staff session failed");
}

type Page = import("playwright").Page;

async function scanPage(page: Page, routeKey: string, shotName: string) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/shots/${shotName}`, fullPage: true });

  // Guard card actions only — instructional prose may still mention activities.
  const labels = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("a, button"));
    const texts = buttons
      .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return {
      editCount: texts.filter((t) => t === "Edit").length,
      customizeCount: texts.filter((t) => t === "Customize").length,
      previewCount: texts.filter((t) => t === "Preview").length,
      editActivitiesCount: texts.filter((t) => /^Edit activities$/i.test(t) || t === "Edit activities").length,
      sample: texts.filter((t) => /^(Edit|Customize|Preview|Use|Send to client)/i.test(t)).slice(0, 20),
    };
  });
  record(`${routeKey}_no_edit_activities_button`, labels.editActivitiesCount === 0, JSON.stringify(labels));
  record(`${routeKey}_has_edit`, labels.editCount > 0, `edit=${labels.editCount}`);
  record(`${routeKey}_has_preview`, labels.previewCount > 0, `preview=${labels.previewCount}`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  record(`${routeKey}_no_h_overflow`, !overflow, `overflow=${overflow}`);

  // Click first visible Edit and confirm we open a detail/editor URL (not still on the list root).
  const editLink = page.getByRole("link", { name: /^Edit$/i }).first();
  if ((await editLink.count()) > 0) {
    const href = await editLink.getAttribute("href");
    const before = page.url();
    await editLink.click();
    await page.waitForTimeout(2500);
    const after = page.url();
    const navigated =
      Boolean(href) &&
      after !== before &&
      (href!.startsWith("/") ? after.includes(href!) : after.includes(href!.replace(APP, "")));
    record(`${routeKey}_edit_navigates`, navigated, `href=${href} before=${before} after=${after}`);
    await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(1500);
  } else {
    record(`${routeKey}_edit_navigates`, false, "no Edit link found");
  }
}

async function main() {
  const image = await servingImage();
  record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ at: new Date().toISOString(), checks, image }, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(await staffCookies());
  const page = await ctx.newPage();

  const routes: Array<{ key: string; path: string }> = [
    { key: "inventory", path: "/library/inventory-templates" },
    { key: "floor", path: "/library/floor-plan-templates" },
    { key: "event_order", path: "/library/event-order-templates" },
    { key: "timeline", path: "/library/timeline-templates" },
    { key: "playbooks", path: "/library/playbooks" },
    { key: "questionnaires", path: "/library/questionnaire-templates" },
  ];

  try {
    for (const r of routes) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${APP}${r.path}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await scanPage(page, `${r.key}_desktop`, `${r.key}-desktop.png`);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${APP}${r.path}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await scanPage(page, `${r.key}_390`, `${r.key}-390.png`);
    }
  } finally {
    await browser.close();
  }

  const ok = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ at: new Date().toISOString(), expectedSha: EXPECTED, image, checks, ok }, null, 2),
  );
  console.log(ok ? "VERDICT=GREEN" : "VERDICT=OPEN");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
