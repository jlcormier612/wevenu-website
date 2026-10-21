/**
 * Sandbox: one supported MC vendor import still succeeds; portal guest UI still
 * exposes Import CSV. Uses Fancy magic-link (no credential rotation).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/guest-list-venue-import-removal";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 240)}`);
}

const stamp = Date.now().toString(36);
const vendorName = `GLRemVendor ${stamp}`;
const vendorEmail = `glrem.vendor.${stamp}@example.invalid`;
const csvPath = `${OUT}/fixtures-vendor-${stamp}.csv`;

async function cookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email", token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com",
      path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: FANCY,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function waitUntilGone(page: any, re: RegExp, ms: number) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const t = await page.locator("body").innerText();
    if (!re.test(t)) return;
    await page.waitForTimeout(400);
  }
}

async function scrollMain(page: any) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.waitForTimeout(200);
}

async function main() {
  writeFileSync(csvPath, [
    "businessName,email,category,contactName",
    `"${vendorName}",${vendorEmail},photographer,Alex Probe`,
    "",
  ].join("\n"));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/settings/migration?source=another_system`, {
      waitUntil: "domcontentloaded", timeout: 90000,
    });
    await page.waitForTimeout(1500);
    await scrollMain(page);
    const another = page.getByText("Another system", { exact: true });
    if ((await another.count()) > 0) await another.first().click();
    await page.waitForTimeout(400);

    await page.locator("button[role='combobox']").first().click();
    await page.waitForTimeout(350);
    const entityOpt = page.getByRole("option", { name: /^Vendors$/i });
    record("vendor_option_present", (await entityOpt.count()) > 0, "Vendors");
    await entityOpt.first().click();
    await page.waitForTimeout(500);

    await page.locator('input[type="file"][accept=".csv"]').setInputFiles(csvPath);
    await page.waitForTimeout(2000);
    await scrollMain(page);

    const bring = page.getByRole("button", { name: /Bring in \d+ row/i });
    record("vendor_bring_button", (await bring.count()) > 0, "Bring in N row(s)");
    if ((await bring.count()) > 0) {
      await bring.first().click();
      await waitUntilGone(page, /^Working/i, 90000);
      await page.waitForTimeout(1200);
      await scrollMain(page);

      for (let round = 0; round < 12; round++) {
        const hist = page.getByRole("button", { name: /Import as historical record/i });
        const approve = page.getByRole("button", { name: /^Approve$/i });
        if ((await hist.count()) > 0) { await hist.first().click(); await page.waitForTimeout(1000); continue; }
        if ((await approve.count()) > 0) { await approve.first().click(); await page.waitForTimeout(1000); continue; }
        break;
      }

      let committed = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        const commitBtn = page.getByRole("button", { name: /Import \d+ records?/i });
        if ((await commitBtn.count()) > 0 && await commitBtn.first().isEnabled()) {
          await commitBtn.first().click();
          committed = true;
          await waitUntilGone(page, /^Importing/i, 60000);
          await page.waitForTimeout(2000);
          break;
        }
        await page.waitForTimeout(700);
      }
      record("vendor_commit_clicked", committed, committed ? "Import N records" : "commit button missing");
    }

    // Wait for Importing… to finish (commit is async in UI)
    for (let i = 0; i < 40; i++) {
      const t = await page.locator("body").innerText();
      if (!/Importing/i.test(t)) break;
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `${OUT}/mc-vendor-import-1280.png`, fullPage: true });

    // Vendors are global rows + venue_vendor_relationships (no vendors.venue_id).
    const { data: recentSessions } = await admin.from("migration_sessions")
      .select("id,status,created_at")
      .eq("venue_id", FANCY)
      .order("created_at", { ascending: false })
      .limit(1);
    const sessionId = recentSessions?.[0]?.id;
    const { data: recs } = sessionId
      ? await admin.from("migration_records")
        .select("id,status,created_entity_id,raw_payload,target_entity_type")
        .eq("session_id", sessionId)
        .eq("target_entity_type", "vendor")
      : { data: null as null };
    const match = (recs ?? []).find((r) => {
      const raw = r.raw_payload as { email?: string; businessName?: string };
      return raw?.email === vendorEmail || raw?.businessName === vendorName;
    });
    const entityId = match?.created_entity_id as string | null | undefined;
    const { data: vendor } = entityId
      ? await admin.from("vendors").select("id,business_name,email").eq("id", entityId).maybeSingle()
      : { data: null };
    const { data: rel } = entityId
      ? await admin.from("venue_vendor_relationships").select("id,venue_id,vendor_id").eq("vendor_id", entityId).eq("venue_id", FANCY)
      : { data: null };
    record(
      "supported_vendor_import_persisted",
      match?.status === "committed" && !!vendor?.id && (rel?.length ?? 0) > 0,
      `session=${sessionId} status=${match?.status} vendor=${vendor?.id ?? "none"} rels=${rel?.length ?? 0}`,
    );
    if (entityId) {
      await admin.from("venue_vendor_relationships").delete().eq("vendor_id", entityId);
      await admin.from("vendors").delete().eq("id", entityId);
    }

    // Portal guest UI
    const { data: tokenRow } = await admin.from("client_portal_sessions")
      .select("access_token,client_id,venue_id")
      .eq("venue_id", FANCY)
      .not("access_token", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenRow?.access_token) {
      await page.goto(`${APP}/p/${tokenRow.access_token}#guests`, {
        waitUntil: "domcontentloaded", timeout: 90000,
      });
      await page.waitForTimeout(3000);
      // Some shells need a second hash navigation after hydrate
      await page.evaluate(() => { window.location.hash = "guests"; });
      await page.waitForTimeout(1500);
      const guestTab = page.locator("a,button,[role='tab']").filter({ hasText: /Guest/i }).first();
      if (await guestTab.isVisible().catch(() => false)) {
        await guestTab.click();
        await page.waitForTimeout(1500);
      }
      const body = await page.locator("body").innerText();
      record(
        "portal_guest_import_csv_ui",
        /Import CSV/i.test(body) || /CSV format:\s*First Name/i.test(body) || /Add guests one at a time/i.test(body),
        /Import CSV/i.test(body)
          ? "Import CSV visible"
          : body.slice(0, 220).replace(/\s+/g, " "),
      );
      await page.screenshot({ path: `${OUT}/portal-guests-1280.png`, fullPage: true });
    } else {
      record("portal_guest_import_csv_ui", false, "no Fancy portal session");
    }
  } catch (e) {
    record("supported_portal_error", false, e instanceof Error ? e.message : String(e));
    await page.screenshot({ path: `${OUT}/supported-portal-error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const summary = {
    stamp,
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
    checks,
  };
  writeFileSync(`${OUT}/supported-portal-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY pass=${summary.pass} fail=${summary.fail}`);
  if (summary.fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
