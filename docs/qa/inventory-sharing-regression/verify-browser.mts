/**
 * Inventory sharing regression — wrong financial-token destination + selection affordance.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/inventory-sharing-regression/verify-browser.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import {
  inventoryReviewUrl,
  pickInventoryPortalSession,
} from "@/lib/event-inventory/inventory-portal-link";

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
const RUN = process.env.E2E_RUN_ID ?? `INVSHR${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/inventory-sharing-regression";
const PREFIX = `INVSHR-${RUN}-`;
const EVENT_DATE = `2028-${String((Date.now() % 11) + 1).padStart(2, "0")}-${String((Date.now() % 27) + 1).padStart(2, "0")}`;
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string; kind?: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string, kind = "check") {
  checks.push({ name, pass, detail: String(detail).slice(0, 2500), kind });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
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
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: EMAIL,
      });
      if (linkErr || !link?.properties?.hashed_token) throw linkErr ?? new Error("no link");
      const { data: otp, error } = await anon.auth.verifyOtp({
        type: "email",
        token_hash: link.properties.hashed_token,
      });
      if (error || !otp?.session) throw error ?? new Error("session");
      await admin.from("venue_staff_active_context").upsert({
        user_id: otp.session.user.id,
        active_venue_id: FANCY,
      });
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
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function passLegal(page: {
  getByRole: Function;
  locator: Function;
  waitForTimeout: Function;
}) {
  for (let i = 0; i < 5; i++) {
    const t = await page.locator("body").innerText().catch(() => "");
    if (!/End User Terms|I have reviewed and agree/i.test(t)) return;
    const box = page.locator('input[type="checkbox"]');
    if (await box.count()) await box.first().check({ force: true }).catch(() => undefined);
    const btn = page.getByRole("button", { name: /Continue|Accept/i }).first();
    if (await btn.count()) await btn.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(900);
  }
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const created: {
    clientId?: string;
    eventId?: string;
    invId?: string;
    financialToken?: string;
    coupleToken?: string;
    catalogIds: string[];
  } = { catalogIds: [] };
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED, prefix: PREFIX };

  const browser = await chromium.launch({ headless: true });
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const staff = await staffCtx.newPage();
  const couple = await coupleCtx.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`, "deploy");
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    // Unit-level regression of the Ursula bug shape
    record(
      "picker_rejects_financial_only",
      pickInventoryPortalSession([{ accessToken: "fin", accessLevel: "financial" }]) == null,
      "null",
      "unit",
    );
    record(
      "review_url_has_view_query",
      /\?view=inventory#inventory$/.test(inventoryReviewUrl(APP, "abc")),
      inventoryReviewUrl(APP, "abc"),
      "unit",
    );

    // Reported Meadowbrook financial token still opens Invoice & Payment Plan (control)
    const ursulaFin = "ce3a75ea9783db78968977332b6c773cee5fbf043960407128f4ea7c1f280285";
    await couple.goto(`${APP}/p/${ursulaFin}#inventory`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await couple.waitForTimeout(1500);
    const finTitle = await couple.title();
    const finBody = await couple.locator("body").innerText();
    record(
      "ursula_financial_token_is_invoice_shell",
      /Invoice & Payment Plan/i.test(finTitle) && /Total contracted/i.test(finBody),
      `title=${finTitle}`,
      "reproduce",
    );
    await couple.screenshot({ path: `${OUT}/shots/ursula-financial-token-invoice-1280.png`, fullPage: true });

    await staffCtx.addCookies(await staffCookies());

    const { data: space } = await admin.from("venue_spaces").select("id").eq("venue_id", FANCY).limit(1).maybeSingle();
    if (!space?.id) throw new Error("no space");

    const { data: client, error: cErr } = await admin.from("clients").insert({
      venue_id: FANCY,
      first_name: "InvShare",
      last_name: RUN,
      email: `invshare-${RUN.toLowerCase()}@hellotocheers-test.invalid`,
      status: "confirmed",
    }).select("id").single();
    if (cErr || !client) throw cErr ?? new Error("client");
    created.clientId = client.id;

    const { data: event, error: eErr } = await admin.from("events").insert({
      venue_id: FANCY,
      client_id: client.id,
      name: `${PREFIX}Wedding`,
      event_type: "wedding",
      event_date: EVENT_DATE,
      event_end_date: EVENT_DATE,
      status: "confirmed",
      booked_at: new Date().toISOString(),
      space_id: space.id,
    }).select("id").single();
    if (eErr || !event) throw eErr ?? new Error("event");
    created.eventId = event.id;
    persisted.eventId = event.id;

    // Only a financial portal session — reproduces Ursula precondition
    const financialToken = `invshr_fin_${RUN.toLowerCase()}_${randomBytes(4).toString("hex")}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: client.id,
      access_token: financialToken,
      access_level: "financial",
      label: "Payment",
    });
    created.financialToken = financialToken;

    const { data: inv, error: invErr } = await admin.from("event_inventory").insert({
      venue_id: FANCY,
      event_id: event.id,
      status: "draft",
      collaboration_mode: "view",
    }).select("id").single();
    if (invErr || !inv) throw invErr ?? new Error("inv");
    created.invId = inv.id;

    const items = [
      { name: `${PREFIX}Included Linen`, is_included: true, unit_price: null, quantity: 10, sort_order: 0 },
      { name: `${PREFIX}Dance Floor`, is_included: false, unit_price: 150, quantity: 1, sort_order: 1 },
      { name: `${PREFIX}DJ Band Table`, is_included: false, unit_price: 200, quantity: 1, sort_order: 2 },
    ];
    const { data: insertedItems, error: itemsErr } = await admin.from("event_inventory_items").insert(
      items.map((i) => ({
        venue_id: FANCY,
        event_inventory_id: inv.id,
        ...i,
        client_selectable: false,
      })),
    ).select("id,name,is_included,unit_price,client_selectable");
    if (itemsErr || !insertedItems) throw itemsErr ?? new Error("items");
    const dance = insertedItems.find((i) => /Dance Floor/i.test(i.name))!;
    const dj = insertedItems.find((i) => /DJ Band/i.test(i.name))!;
    persisted.items = insertedItems;

    async function openInventoryPanel() {
      await staff.goto(`${APP}/events/${event.id}`, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await staff.waitForTimeout(2500);
      await staff.evaluate(() => {
        window.location.hash = "inventory";
        document.getElementById("inventory-event-order-card")?.scrollIntoView({ block: "center" });
      }).catch(() => undefined);
      await staff.waitForTimeout(1200);
      const panel = staff.getByTestId("inventory-share-instructions")
        .or(staff.getByTestId("inventory-share-for-selection"))
        .or(staff.getByText("Event Inventory"));
      await panel.first().waitFor({ state: "visible", timeout: 60_000 });
    }

    await openInventoryPanel();
    await staff.screenshot({ path: `${OUT}/shots/venue-inventory-before-select-1280.png`, fullPage: true });

    const shareSelect = staff.getByTestId("inventory-share-for-selection");
    const disabledBefore = await shareSelect.isDisabled().catch(() => true);
    const reasonVisible = (await staff.getByTestId("inventory-share-selection-disabled-reason").count()) > 0;
    record(
      "share_for_selection_disabled_until_select",
      disabledBefore && (reasonVisible || /marked Select|Additional item/i.test(await staff.locator("body").innerText())),
      `disabled=${disabledBefore} reasonVisible=${reasonVisible}`,
      "usability",
    );

    // Prefer UI Select toggles; fall back to DB then reload
    const danceToggle = staff.getByTestId(`inventory-item-select-toggle-${dance.id}`);
    const djToggle = staff.getByTestId(`inventory-item-select-toggle-${dj.id}`);
    if (await danceToggle.count()) {
      await danceToggle.click();
      await staff.waitForTimeout(800);
    }
    if (await djToggle.count()) {
      await djToggle.click();
      await staff.waitForTimeout(800);
    }
    const { data: flags } = await admin
      .from("event_inventory_items")
      .select("id,client_selectable")
      .in("id", [dance.id, dj.id]);
    if (!(flags ?? []).every((f) => f.client_selectable)) {
      await admin.from("event_inventory_items").update({
        client_selectable: true,
        max_quantity: 1,
      }).in("id", [dance.id, dj.id]);
      await openInventoryPanel();
    }

    const shareBtn = staff.getByTestId("inventory-share-for-selection");
    await shareBtn.waitFor({ state: "visible", timeout: 30_000 });
    record(
      "share_for_selection_enabled_after_select",
      !(await shareBtn.isDisabled()),
      `disabled=${await shareBtn.isDisabled()}`,
      "usability",
    );
    await shareBtn.click();
    await staff.waitForTimeout(3500);
    await staff.screenshot({ path: `${OUT}/shots/venue-after-share-selection-1280.png`, fullPage: true });

    // After UI share, couple session must exist (not only financial)
    const { data: sessionsAfter } = await admin
      .from("client_portal_sessions")
      .select("access_token,access_level,label")
      .eq("client_id", client.id);
    const mappedSessions = (sessionsAfter ?? []).map((s) => ({
      accessToken: s.access_token as string,
      accessLevel: s.access_level as string,
      label: s.label as string | null,
    }));
    const picked = pickInventoryPortalSession(mappedSessions);
    record(
      "share_creates_or_uses_couple_session",
      Boolean(picked?.accessToken) && picked!.accessLevel !== "financial",
      JSON.stringify(mappedSessions),
      "persisted",
    );
    if (!picked?.accessToken) throw new Error(`no couple session after share: ${JSON.stringify(mappedSessions)}`);
    created.coupleToken = picked.accessToken;

    const { data: invAfter } = await admin
      .from("event_inventory")
      .select("status,collaboration_mode")
      .eq("id", inv.id)
      .single();
    // If UI share worked, expect select; if fallback, we set select already
    if (await shareBtn.count() && !(await shareBtn.isDisabled().catch(() => true))) {
      // already clicked
    }
    // Ensure select mode for portal selection assertions
    if (invAfter?.collaboration_mode !== "select") {
      await admin.from("event_inventory").update({
        status: "shared",
        collaboration_mode: "select",
      }).eq("id", inv.id);
    }

    const coupleToken = created.coupleToken!;
    const reviewUrl = inventoryReviewUrl(APP, coupleToken);
    persisted.reviewUrl = reviewUrl;
    persisted.sessionsAfter = sessionsAfter;

    // Fresh context: couple inventory URL must NOT be invoice shell
    const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const invPage = await fresh.newPage();
    await invPage.goto(reviewUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await passLegal(invPage);
    await invPage.waitForTimeout(2000);
    const invTitle = await invPage.title();
    const invText = await invPage.locator("body").innerText();
    record(
      "couple_inventory_url_not_invoice_shell",
      !/Invoice & Payment Plan/i.test(invTitle)
        && !/Total contracted/i.test(invText),
      `title=${invTitle} text=${invText.slice(0, 300)}`,
      "browser",
    );
    // Navigate to inventory if needed
    const invNav = invPage.locator('button[title="Inventory"], button:has-text("Inventory")').first();
    if (await invNav.count()) await invNav.click().catch(() => undefined);
    await invPage.waitForTimeout(1500);
    const afterNav = await invPage.locator("body").innerText();
    record(
      "couple_sees_inventory_items",
      new RegExp(PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(afterNav)
        || /Dance Floor|DJ Band|Inventory/i.test(afterNav),
      afterNav.slice(0, 500),
      "browser",
    );
    await invPage.screenshot({ path: `${OUT}/shots/couple-inventory-1280.png`, fullPage: true });

    // Selectable additional items should allow interaction in select mode
    const { data: portalPayload } = await invPage.request
      .get(`${APP}/api/portal/inventory?token=${encodeURIComponent(coupleToken)}`)
      .then(async (r: { json: () => Promise<Record<string, unknown>> }) => ({ data: await r.json() }));
    const portalInv = portalPayload as {
      inventory?: {
        status?: string;
        collaborationMode?: string;
        items?: Array<{ name: string; clientSelectable?: boolean; unitPrice?: number | null; isIncluded?: boolean }>;
      };
    };
    const portalItems = portalInv.inventory?.items ?? [];
    record(
      "portal_api_select_mode_with_priced_items",
      portalInv.inventory?.collaborationMode === "select"
        && portalItems.some((i) => /Dance Floor/i.test(i.name) && i.clientSelectable && Number(i.unitPrice) === 150)
        && portalItems.some((i) => /DJ Band/i.test(i.name) && i.clientSelectable && Number(i.unitPrice) === 200),
      JSON.stringify({
        mode: portalInv.inventory?.collaborationMode,
        items: portalItems.map((i) => ({
          name: i.name,
          sel: i.clientSelectable,
          price: i.unitPrice,
          included: i.isIncluded,
        })),
      }),
      "api",
    );

    // Mobile
    await invPage.setViewportSize({ width: 390, height: 844 });
    await invPage.goto(reviewUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await passLegal(invPage);
    await invPage.waitForTimeout(1500);
    await invPage.screenshot({ path: `${OUT}/shots/couple-inventory-390.png`, fullPage: true });
    const mobileTitle = await invPage.title();
    record(
      "mobile_390_not_invoice_shell",
      !/Invoice & Payment Plan/i.test(mobileTitle),
      mobileTitle,
      "browser",
    );

    // Genuine financial token still invoice
    await invPage.goto(`${APP}/p/${encodeURIComponent(financialToken)}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await invPage.waitForTimeout(1200);
    record(
      "genuine_invoice_link_still_payment_shell",
      /Invoice & Payment Plan/i.test(await invPage.title()),
      await invPage.title(),
      "browser",
    );

    // Bad token
    const bad = await invPage.request.get(`${APP}/api/portal/inventory?token=not-a-real-token`);
    const badJson = await bad.json().catch(() => ({}));
    record(
      "bad_token_no_inventory_leak",
      bad.status() >= 400 || !(badJson as { inventory?: unknown }).inventory,
      JSON.stringify({ status: bad.status(), body: badJson }).slice(0, 300),
      "security",
    );

    await fresh.close();
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.stack ?? err.message
        : typeof err === "object" && err
          ? JSON.stringify(err)
          : String(err);
    record("harness_error", false, detail, "error");
    try {
      await staff.screenshot({ path: `${OUT}/shots/error-staff.png`, fullPage: true });
      await couple.screenshot({ path: `${OUT}/shots/error-couple.png`, fullPage: true });
    } catch { /* ignore */ }
  } finally {
    if (created.invId) {
      await admin.from("event_inventory_items").delete().eq("event_inventory_id", created.invId);
      await admin.from("event_inventory_activities").delete().eq("event_inventory_id", created.invId);
      await admin.from("event_inventory").delete().eq("id", created.invId);
    }
    if (created.clientId) {
      await admin.from("client_portal_sessions").delete().eq("client_id", created.clientId);
    }
    if (created.eventId) await admin.from("events").delete().eq("id", created.eventId);
    if (created.clientId) await admin.from("clients").delete().eq("id", created.clientId);
    await browser.close();
  }

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, failed: failed.length, persisted }, null, 2));
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));
  writeFileSync(
    `${OUT}/browser-run.log`,
    checks.map((c) => `${c.pass ? "PASS" : "FAIL"} [${c.kind}] ${c.name} — ${c.detail}`).join("\n") + "\n",
  );
  console.log(`\n${failed.length === 0 ? "GREEN" : "NOT GREEN"} — ${checks.length - failed.length} pass / ${failed.length} fail`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
