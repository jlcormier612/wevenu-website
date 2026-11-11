/**
 * Verify staff sidebar Wordmark uses primary brand asset in light + dark.
 * Sandbox only. No mutations.
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
const OUT = "docs/qa/dark-mode-logo-contrast";
const PRIMARY = "/brand/hello-to-cheers-logo-primary-transparent.png";
const ON_DARK = "/brand/hello-to-cheers-logo-on-dark-transparent.png";

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

async function logoProbe(page: import("playwright").Page) {
  return page.evaluate(
    ({ primary, onDark }) => {
      const aside = document.querySelector("aside");
      const imgs = aside
        ? Array.from(aside.querySelectorAll("img"))
        : Array.from(document.querySelectorAll('img[alt="Hello to Cheers"]'));
      const logo =
        imgs.find((i) => (i.getAttribute("src") || "").includes("/brand/")) ??
        imgs[0] ??
        null;
      if (!logo) {
        return { found: false } as const;
      }
      const src = logo.getAttribute("src") || "";
      const cs = getComputedStyle(logo);
      const parent = logo.closest("aside") ?? logo.parentElement;
      const bg = parent ? getComputedStyle(parent).backgroundColor : "";
      const rect = logo.getBoundingClientRect();
      return {
        found: true,
        src,
        isPrimary: src.includes(primary.split("/").pop()!),
        isOnDark: src.includes(onDark.split("/").pop()!),
        opacity: cs.opacity,
        filter: cs.filter,
        mixBlend: cs.mixBlendMode,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        bg,
      };
    },
    { primary: PRIMARY, onDark: ON_DARK },
  );
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
  try {
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        colorScheme: theme,
      });
      await context.addCookies(cookies);
      const page = await context.newPage();
      await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1200);
      // Force theme class if app uses class strategy
      await page.evaluate((t) => {
        const root = document.documentElement;
        if (t === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
        localStorage.setItem("theme", t);
      }, theme);
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `${OUT}/sidebar-${theme}-1280.png`,
        fullPage: false,
      });

      const probe = await logoProbe(page);
      record(
        `${theme}: logo found`,
        Boolean(probe.found),
        JSON.stringify(probe),
      );
      if (probe.found) {
        record(`${theme}: uses primary asset`, probe.isPrimary === true, `src=${probe.src}`);
        record(`${theme}: not on-dark asset`, probe.isOnDark === false, `src=${probe.src}`);
        record(
          `${theme}: no opacity wash`,
          Number(probe.opacity) >= 0.99,
          `opacity=${probe.opacity}`,
        );
        record(
          `${theme}: no filter wash`,
          !probe.filter || probe.filter === "none",
          `filter=${probe.filter}`,
        );
        record(
          `${theme}: logo sized`,
          (probe.height ?? 0) >= 40 && (probe.width ?? 0) >= 80,
          `w=${probe.width} h=${probe.height}`,
        );
      }
      await context.close();
    }

    // Narrow dark
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
    });
    await context.addCookies(cookies);
    const page = await context.newPage();
    await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/sidebar-dark-390.png` });
    const mobileLogo = await page.evaluate(() => {
      const img = document.querySelector('img[alt="Hello to Cheers"]') as HTMLImageElement | null;
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return { src: img.src, w: Math.round(r.width), h: Math.round(r.height) };
    });
    record(
      "narrow dark: primary logo present",
      Boolean(mobileLogo?.src?.includes("primary-transparent")),
      JSON.stringify(mobileLogo),
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    record("narrow: no page overflow", !overflow, `overflow=${overflow}`);
    await context.close();
  } finally {
    await browser.close();
  }

  const allPass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify(
      { expectedSha: EXPECTED, servingImage: image, allPass, checks, at: new Date().toISOString() },
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
