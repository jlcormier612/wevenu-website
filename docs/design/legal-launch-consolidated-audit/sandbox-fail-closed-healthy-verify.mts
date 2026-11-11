/**
 * Healthy Sandbox browser reconfirm after fail-closed hardening (local code).
 * Does not inject Sandbox infra failures.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const require = createRequire(import.meta.url);
const ssr = require("@supabase/ssr/dist/main/utils/index.js") as {
  createChunks: (
    name: string,
    value: string,
  ) => Array<{ name: string; value: string }>;
  stringToBase64URL: (value: string) => string;
};

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = path.join(
  process.cwd(),
  "docs/design/legal-launch-consolidated-audit",
);
const fancy = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const currentOwnerEmail =
  "recovery-e2e-1790617113989@hellotocheers-test.invalid";
const currentOwnerVenue = "9d67030d-365f-472d-9dcc-817007b7c1cb";
const vendorOnlyEmail = "vendor-network-e2e@hellotocheers.com";
const jen = "jennifer@hellotocheers.com";

const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(sbUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(sbUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const PROJECT_REF = new URL(sbUrl).hostname.split(".")[0];

type Result = {
  id: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  observed: string;
};

async function acceptanceCount(email: string) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = (data.users || []).find(
    (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
  );
  if (!user) return null;
  const { count } = await admin
    .from("legal_acceptances")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  return { userId: user.id, count: count ?? 0 };
}

async function injectVenue(ctx: Awaited<ReturnType<typeof chromium.launch>> extends never ? never : import("playwright").BrowserContext, email: string, venueId: string | null) {
  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const { data: otp } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  const base = {
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  };
  const cookies = ssr
    .createChunks(
      `sb-${PROJECT_REF}-auth-token`,
      "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session)),
    )
    .map((c) => ({ ...base, ...c }));
  await ctx.addCookies(cookies);
  if (venueId) {
    await ctx.addCookies([
      {
        name: "htc_active_venue_id",
        value: venueId,
        ...base,
      },
    ]);
  }
}

async function injectVendor(ctx: import("playwright").BrowserContext, email: string) {
  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const { data: otp } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  const base = {
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  };
  const cookies = ssr
    .createChunks(
      `sb-${PROJECT_REF}-vendor-auth-token`,
      "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session)),
    )
    .map((c) => ({ ...base, ...c }));
  await ctx.addCookies(cookies);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const results: Result[] = [];
  const browser = await chromium.launch({ headless: true });

  // Note: Sandbox still serves 960cad12 without this fail-closed patch.
  // Healthy behavior must remain correct; failure injection is local-only.
  {
    const before = await acceptanceCount(jen);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await injectVenue(ctx, jen, fancy);
      await page.goto(`${APP}/dashboard`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2500);
      const url = page.url();
      const body = await page.locator("body").innerText();
      await page.screenshot({
        path: path.join(OUT, "verify-failclosed-jen-welcome.png"),
        fullPage: true,
      });
      const after = await acceptanceCount(jen);
      results.push({
        id: "outdated-owner-welcome",
        status:
          url.includes("/welcome") &&
          /venue subscription/i.test(body) &&
          before?.count === after?.count
            ? "PASS"
            : "FAIL",
        observed: `${url}; acc ${before?.count}->${after?.count}`,
      });
    } catch (e) {
      results.push({
        id: "outdated-owner-welcome",
        status: "BLOCKED",
        observed: String(e),
      });
    } finally {
      await ctx.close();
    }
  }

  {
    const before = await acceptanceCount(currentOwnerEmail);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await injectVenue(ctx, currentOwnerEmail, currentOwnerVenue);
      await page.goto(`${APP}/dashboard`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2500);
      const url = page.url();
      const after = await acceptanceCount(currentOwnerEmail);
      results.push({
        id: "current-owner-proceeds",
        status:
          url.includes("/dashboard") &&
          !url.includes("/welcome") &&
          before?.count === after?.count
            ? "PASS"
            : "FAIL",
        observed: `${url}; acc ${before?.count}->${after?.count}`,
      });
    } catch (e) {
      results.push({
        id: "current-owner-proceeds",
        status: "BLOCKED",
        observed: String(e),
      });
    } finally {
      await ctx.close();
    }
  }

  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await injectVendor(ctx, vendorOnlyEmail);
      await page.goto(`${APP}/vendor/dashboard`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2500);
      const url = page.url();
      const body = await page.locator("body").innerText();
      const vsa = /venue subscription/i.test(body);
      results.push({
        id: "vendor-only-routing",
        status: url.includes("/welcome") && !vsa ? "PASS" : "FAIL",
        observed: `${url}; vsa=${vsa}; privacy=${/privacy/i.test(body)}`,
      });
    } catch (e) {
      results.push({
        id: "vendor-only-routing",
        status: "BLOCKED",
        observed: String(e),
      });
    } finally {
      await ctx.close();
    }
  }

  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await page.goto(`${APP}/login`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      const loginOk = page.url().includes("/login");
      await page.goto(`${APP}/system/legal-unavailable`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      // Deployed Sandbox may 404 until this patch is deployed — mark BLOCKED/FAIL accordingly.
      const status = page.url();
      const body = await page.locator("body").innerText();
      const hasCopy = /couldn.?t complete a required compliance check|right back|temporarily unavailable/i.test(
        body,
      );
      results.push({
        id: "login-reachable",
        status: loginOk ? "PASS" : "FAIL",
        observed: `login ok=${loginOk}`,
      });
      results.push({
        id: "recovery-page-on-deployed-sandbox",
        status: hasCopy
          ? "PASS"
          : "BLOCKED",
        observed: hasCopy
          ? status
          : `Not deployed yet on Sandbox (${status}); local page exists. body=${body.slice(0, 160)}`,
      });
    } catch (e) {
      results.push({
        id: "login-reachable",
        status: "BLOCKED",
        observed: String(e),
      });
    } finally {
      await ctx.close();
    }
  }

  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    note: "Sandbox host still serves pre-fail-closed commit until separately authorized deploy. Healthy gates must still PASS.",
    servingExpectedPreDeploy: "960cad1242cbd2c5236acc39e11a5cec0e8bcf66",
    results,
    summary: {
      pass: results.filter((r) => r.status === "PASS").length,
      fail: results.filter((r) => r.status === "FAIL").length,
      blocked: results.filter((r) => r.status === "BLOCKED").length,
    },
  };
  await writeFile(
    path.join(OUT, "browser-fail-closed-healthy-verify.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
