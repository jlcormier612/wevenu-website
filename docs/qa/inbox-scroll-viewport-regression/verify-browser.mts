/**
 * Post-fix Sandbox verify — Inbox page-flow must not overlap workspace header.
 * EXPECTED_SHA required. No sends.
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
const OUT = "docs/qa/inbox-scroll-viewport-regression";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const CONVERSATION = "e389ecd5-4c11-42ca-af5f-4896c76df69b";

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

async function layout(page: { evaluate: (s: string) => Promise<unknown> }) {
  return page.evaluate(`(() => {
    const header = document.querySelector("header");
    const main = document.querySelector("[data-workspace-main]");
    const shell = document.querySelector(".htc-staff");
    const hr = header && header.getBoundingClientRect();
    const mr = main && main.getBoundingClientRect();
    const sr = shell && shell.getBoundingClientRect();
    return {
      headerTop: hr ? Math.round(hr.top) : null,
      headerBottom: hr ? Math.round(hr.bottom) : null,
      mainTop: mr ? Math.round(mr.top) : null,
      mainBottom: mr ? Math.round(mr.bottom) : null,
      mainHeight: mr ? Math.round(mr.height) : null,
      overlap: hr && mr ? Math.round(hr.bottom - mr.top) : null,
      gapBelowShell: sr ? Math.round(window.innerHeight - sr.bottom) : null,
      mainScrollTop: main ? Math.round(main.scrollTop) : null,
      innerHeight: window.innerHeight,
    };
  })()`) as Promise<{
    headerTop: number | null;
    headerBottom: number | null;
    mainTop: number | null;
    mainBottom: number | null;
    mainHeight: number | null;
    overlap: number | null;
    gapBelowShell: number | null;
    mainScrollTop: number | null;
    innerHeight: number;
  }>;
}

mkdirSync(OUT, { recursive: true });

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

async function runViewport(width: number, height: number) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addCookies(cookies);
  const page = await context.newPage();
  page.on("console", (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`${APP}/messaging?conversation=${CONVERSATION}`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(2000);
  const afterOpen = await layout(page);
  await page.screenshot({ path: `${OUT}/verify-open-${width}.png`, fullPage: false });

  if (width === 1280) {
    record(
      "No header/main overlap after conversation open",
      afterOpen.overlap === 0 && (afterOpen.mainTop ?? 0) >= 60,
      JSON.stringify(afterOpen),
    );
    record(
      "No shell gap below viewport after open",
      afterOpen.gapBelowShell === 0,
      `gap=${afterOpen.gapBelowShell}`,
    );
  }

  // Expand / collapse cycle
  for (let i = 0; i < 3; i++) {
    const btn = page.locator('button[aria-expanded="false"]').filter({ hasText: /Email/i }).first();
    if ((await btn.count()) > 0) {
      await btn.click();
      await page.waitForTimeout(400);
    }
  }
  let g = 0;
  while (g < 8 && (await page.getByRole("button", { name: "Collapse" }).count()) > 0) {
    await page.getByRole("button", { name: "Collapse" }).first().click();
    await page.waitForTimeout(350);
    g++;
  }
  const afterCycle = await layout(page);
  await page.screenshot({ path: `${OUT}/verify-after-cycle-${width}.png`, fullPage: false });

  await page.evaluate(`(() => {
    const main = document.querySelector("[data-workspace-main]");
    if (main) main.scrollTop = 0;
  })()`);
  await page.waitForTimeout(300);
  const atTop = await layout(page);
  await page.screenshot({ path: `${OUT}/verify-scroll-top-${width}.png`, fullPage: false });

  if (width === 1280) {
    record(
      "No overlap after expand/collapse cycle",
      afterCycle.overlap === 0 && (afterCycle.mainTop ?? 0) >= 60,
      JSON.stringify(afterCycle),
    );
    record(
      "Can scroll main to top",
      atTop.mainScrollTop === 0 && atTop.overlap === 0,
      JSON.stringify(atTop),
    );
    record(
      "Leads/Clients tabs still present",
      (await page.getByRole("button", { name: /Leads/i }).count())
        + (await page.getByRole("button", { name: /Clients/i }).count())
        > 0,
      "category tabs",
    );
    record(
      "Collapsed message rows still present",
      (await page.locator('button[aria-expanded="false"]').filter({ hasText: /Email/i }).count()) > 0,
      "disclosure intact",
    );
  } else {
    record(
      `Narrow ${width}: no overlap after cycle`,
      afterCycle.overlap === 0,
      JSON.stringify(afterCycle),
    );
  }

  await context.close();
  return { afterOpen, afterCycle, atTop };
}

const desktop = await runViewport(1280, 800);
const narrow = await runViewport(390, 844);
await browser.close();

record(
  "No critical console errors",
  !consoleErrors.some((e) => /TypeError|ReferenceError|ChunkLoadError/i.test(e)),
  `errors=${consoleErrors.length}`,
);

const pass = checks.every((c) => c.pass);
const results = {
  at: new Date().toISOString(),
  expectedSha: EXPECTED,
  servingImage: image,
  pass,
  checks,
  desktop,
  narrow,
  consoleErrors: consoleErrors.slice(0, 15),
};
writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
console.log(pass ? "ALL PASS" : "SOME FAIL");
process.exit(pass ? 0 : 1);
