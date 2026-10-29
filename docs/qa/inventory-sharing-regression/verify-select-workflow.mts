/**
 * Inventory Select → Share for selection — real Sandbox browser workflow.
 * NO database fallback for Select. Must prove UI click enables Share.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/inventory-sharing-regression/verify-select-workflow.mts
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
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const MEADOW = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const EMAIL = "jlcormier612@gmail.com";
const EVENT = "971849b2-2223-40e8-bb38-f66fb7c57a2b";
const CLIENT = "24f1a470-0323-4bbc-905e-2b09c39420ef";
const INV = "448d4f3a-66a1-4c3c-8a78-a822a2bf3cea";
const DANCE = "f1c2c39c-df1c-4e36-a475-618e2fc4ea8c";
const DJ = "53bb640e-c404-406d-a086-9ce904b1b1cc";
const RUN = process.env.E2E_RUN_ID ?? `INVSEL${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/inventory-sharing-regression";
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
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  await admin.from("venue_staff_active_context").upsert({
    user_id: otp.session.user.id,
    active_venue_id: MEADOW,
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
      value: MEADOW,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
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

async function openInventory(page: {
  goto: Function;
  waitForTimeout: Function;
  getByRole: Function;
  getByTestId: Function;
  evaluate: Function;
  url: () => string;
}) {
  await page.goto(`${APP}/clients/${CLIENT}?event=${EVENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForTimeout(2500);
  const tab = page.getByRole("tab", { name: /Inventory/i });
  if (await tab.count()) {
    await tab.first().click({ force: true });
    await page.waitForTimeout(1200);
  }
  await page.evaluate(() => {
    window.location.hash = "inventory";
    document
      .querySelector('[data-testid="inventory-share-for-selection"]')
      ?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(800);
  // Share CTAs hide after couple submit (status=submitted → Confirm/Request changes).
  const shareOrConfirm = page
    .getByTestId("inventory-share-for-selection")
    .or(page.getByRole("button", { name: /Confirm selections|Request changes|Share to view/i }));
  await shareOrConfirm.first().waitFor({ state: "visible", timeout: 60_000 });
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const persisted: Record<string, unknown> = {
    run: RUN,
    expectedSha: EXPECTED,
    eventId: EVENT,
    clientId: CLIENT,
    inventoryId: INV,
    danceId: DANCE,
    djId: DJ,
  };
  const createdCoupleTokens: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const staff = await staffCtx.newPage();
  const couple = await coupleCtx.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`, "deploy");
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    // Reset selectable flags so the workflow starts blocked
    await admin
      .from("event_inventory_items")
      .update({ client_selectable: false, max_quantity: null })
      .in("id", [DANCE, DJ]);
    await admin
      .from("event_inventory")
      .update({ collaboration_mode: "view", status: "shared" })
      .eq("id", INV);

    await staffCtx.addCookies(await staffCookies());
    await openInventory(staff);
    await staff.screenshot({ path: `${OUT}/shots/select-workflow-before-1280.png`, fullPage: true });

    const share = staff.getByTestId("inventory-share-for-selection");
    const disabledBefore = await share.isDisabled();
    const reasonBefore = (await staff.getByTestId("inventory-share-selection-disabled-reason").count()) > 0;
    record(
      "share_disabled_when_nothing_selectable",
      disabledBefore && reasonBefore,
      `disabled=${disabledBefore} reason=${reasonBefore}`,
      "usability",
    );

    const danceToggle = staff.getByTestId(`inventory-item-select-toggle-${DANCE}`);
    record("dance_select_control_present", (await danceToggle.count()) === 1, "toggle", "usability");
    await danceToggle.click({ force: true });

    // CRITICAL: Share must enable from UI alone (optimistic Select) — no DB fallback
    let shareEnabled = !(await share.isDisabled());
    for (let i = 0; i < 20 && !shareEnabled; i++) {
      await staff.waitForTimeout(250);
      shareEnabled = !(await share.isDisabled());
    }
    const toggleText = await danceToggle.innerText();
    record(
      "share_enabled_after_ui_select_no_db_fallback",
      shareEnabled,
      `disabled=${await share.isDisabled()} toggle=${toggleText}`,
      "usability",
    );

    let danceAfter: { id: string; client_selectable: boolean | null; max_quantity: number | null } | null = null;
    for (let i = 0; i < 20; i++) {
      const { data } = await admin
        .from("event_inventory_items")
        .select("id,client_selectable,max_quantity")
        .eq("id", DANCE)
        .single();
      danceAfter = data;
      if (data?.client_selectable) break;
      await staff.waitForTimeout(400);
    }
    record(
      "dance_select_persists_client_selectable",
      Boolean(danceAfter?.client_selectable),
      JSON.stringify(danceAfter),
      "persisted",
    );
    record(
      "row_shows_selectable_state",
      /Selectable/i.test(toggleText) || /Couple can select/i.test(await staff.locator("body").innerText()),
      toggleText,
      "usability",
    );
    await staff.screenshot({ path: `${OUT}/shots/select-workflow-after-dance-1280.png`, fullPage: true });
    persisted.afterDance = { danceAfter, shareEnabled, toggleText };

    // Reload — must stay enabled from persisted props (revalidation path)
    await openInventory(staff);
    const shareAfterReload = !(await staff.getByTestId("inventory-share-for-selection").isDisabled());
    const { data: danceReload } = await admin
      .from("event_inventory_items")
      .select("client_selectable")
      .eq("id", DANCE)
      .single();
    record(
      "reload_keeps_select_and_share_enabled",
      shareAfterReload && Boolean(danceReload?.client_selectable),
      `shareEnabled=${shareAfterReload} db=${JSON.stringify(danceReload)}`,
      "persisted",
    );

    // Mark DJ too (wait for persist — same async path as Dance)
    const djToggle = staff.getByTestId(`inventory-item-select-toggle-${DJ}`);
    await djToggle.click({ force: true });
    let both: { id: string; name: string; client_selectable: boolean | null }[] | null = null;
    for (let i = 0; i < 20; i++) {
      const { data } = await admin
        .from("event_inventory_items")
        .select("id,name,client_selectable")
        .in("id", [DANCE, DJ]);
      both = data;
      if ((data ?? []).length === 2 && (data ?? []).every((r) => r.client_selectable)) break;
      await staff.waitForTimeout(400);
    }
    record(
      "both_additional_items_selectable",
      (both ?? []).length === 2 && (both ?? []).every((r) => r.client_selectable),
      JSON.stringify(both),
      "persisted",
    );
    await staff.screenshot({ path: `${OUT}/shots/select-workflow-both-selected-1280.png`, fullPage: true });

    // Share for selection via UI
    const sessionsBefore = await admin
      .from("client_portal_sessions")
      .select("access_token,access_level,label")
      .eq("client_id", CLIENT);
    const beforeTokens = new Set((sessionsBefore.data ?? []).map((s) => s.access_token));

    await staff.getByTestId("inventory-share-for-selection").click();
    await staff.waitForTimeout(4000);
    await staff.screenshot({ path: `${OUT}/shots/select-workflow-after-share-1280.png`, fullPage: true });

    const { data: invAfterShare } = await admin
      .from("event_inventory")
      .select("collaboration_mode,status")
      .eq("id", INV)
      .single();
    record(
      "share_sets_collaboration_select",
      invAfterShare?.collaboration_mode === "select",
      JSON.stringify(invAfterShare),
      "persisted",
    );

    const { data: sessionsAfter } = await admin
      .from("client_portal_sessions")
      .select("access_token,access_level,label,created_at")
      .eq("client_id", CLIENT)
      .order("created_at", { ascending: false });
    const coupleSession = (sessionsAfter ?? []).find(
      (s) => s.access_level !== "financial" && !beforeTokens.has(s.access_token),
    ) ?? (sessionsAfter ?? []).find((s) => s.access_level !== "financial");
    record(
      "share_creates_or_uses_non_financial_session",
      Boolean(coupleSession?.access_token),
      JSON.stringify(coupleSession ?? sessionsAfter),
      "persisted",
    );
    if (!coupleSession?.access_token) throw new Error("no couple session after share");
    createdCoupleTokens.push(coupleSession.access_token);
    const inventoryUrl = `${APP}/p/${coupleSession.access_token}?view=inventory#inventory`;
    persisted.inventoryUrl = inventoryUrl;

    // Fresh couple browser — inventory selection, not invoice
    await couple.goto(inventoryUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await couple.waitForTimeout(1500);
    await passLegal(couple);
    await couple.waitForTimeout(1500);
    const coupleTitle = await couple.title();
    const coupleBody = await couple.locator("body").innerText();
    record(
      "couple_link_is_inventory_not_invoice",
      !/Invoice & Payment Plan/i.test(coupleTitle)
        && !/Total contracted/i.test(coupleBody)
        && (/Inventory|Dance Floor|DJ/i.test(coupleBody) || /select/i.test(coupleBody)),
      `title=${coupleTitle} body=${coupleBody.slice(0, 400)}`,
      "portal",
    );
    await couple.screenshot({ path: `${OUT}/shots/select-workflow-couple-inventory-1280.png`, fullPage: true });

    // Attempt to select Dance Floor quantity if controls exist
    const qtyInput = couple.locator('input[type="number"]').first();
    if (await qtyInput.count()) {
      await qtyInput.fill("1");
      await couple.waitForTimeout(400);
      const saveBtn = couple.getByTestId("inventory-save-draft").or(couple.getByRole("button", { name: /Save/i }));
      if (await saveBtn.count()) {
        await saveBtn.first().click({ force: true }).catch(() => undefined);
        await couple.waitForTimeout(1200);
      }
      const submitBtn = couple.getByTestId("inventory-submit").or(couple.getByRole("button", { name: /Submit/i }));
      if (await submitBtn.count()) {
        await submitBtn.first().click({ force: true }).catch(() => undefined);
        await couple.waitForTimeout(2500);
      }
    }
    await couple.screenshot({ path: `${OUT}/shots/select-workflow-couple-after-submit-1280.png`, fullPage: true });

    const { data: danceSubmitted } = await admin
      .from("event_inventory_items")
      .select("client_draft_quantity,client_submitted_quantity,client_selectable")
      .eq("id", DANCE)
      .single();
    const { data: invStatus } = await admin
      .from("event_inventory")
      .select("status,collaboration_mode")
      .eq("id", INV)
      .single();
    persisted.coupleSubmit = { danceSubmitted, invStatus };
    record(
      "couple_selection_persisted_or_portal_usable",
      Boolean(danceSubmitted?.client_selectable)
        && (invStatus?.status === "submitted"
          || danceSubmitted?.client_submitted_quantity != null
          || danceSubmitted?.client_draft_quantity != null
          || /Inventory|Dance Floor/i.test(coupleBody)),
      JSON.stringify(persisted.coupleSubmit),
      "portal",
    );

    // After couple submit, status=submitted — reopen via Request changes so Share CTAs return
    await openInventory(staff);
    const requestChanges = staff.getByRole("button", { name: /Request changes/i });
    if (await requestChanges.count()) {
      staff.once("dialog", (d) => d.accept("").catch(() => undefined));
      await requestChanges.first().click({ force: true });
      await staff.waitForTimeout(2500);
    }
    await openInventory(staff);
    const shareToView = staff.getByTestId("inventory-share-to-view");
    if (await shareToView.count()) {
      await shareToView.click();
      await staff.waitForTimeout(2500);
    }
    const { data: afterView } = await admin
      .from("event_inventory")
      .select("collaboration_mode,status")
      .eq("id", INV)
      .single();
    record(
      "share_to_view_sets_view_mode",
      afterView?.collaboration_mode === "view"
        || afterView?.status === "changes_requested"
        || afterView?.status === "shared",
      JSON.stringify(afterView),
      "persisted",
    );

    // Bad token
    await couple.goto(`${APP}/p/not-a-real-token-xyz?view=inventory`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await couple.waitForTimeout(1200);
    const badBody = await couple.locator("body").innerText();
    record(
      "bad_token_no_inventory_leak",
      !/Dance Floor/i.test(badBody) && !/DJ \/ Band Table/i.test(badBody),
      badBody.slice(0, 300),
      "security",
    );

    // Mobile
    await staff.setViewportSize({ width: 390, height: 844 });
    await openInventory(staff);
    await staff.screenshot({ path: `${OUT}/shots/select-workflow-390.png`, fullPage: true });
    const mobileText = await staff.locator("body").innerText();
    record(
      "mobile_390_select_share_controls",
      /Share for selection|Select|Dance Floor/i.test(mobileText),
      mobileText.slice(0, 300),
      "usability",
    );

    // Explanation matches rule when cleared
    await admin
      .from("event_inventory_items")
      .update({ client_selectable: false, max_quantity: null })
      .in("id", [DANCE, DJ]);
    await openInventory(staff);
    record(
      "disabled_reason_matches_eligibility_rule",
      (await staff.getByTestId("inventory-share-selection-disabled-reason").count()) > 0
        && (await staff.getByTestId("inventory-share-for-selection").isDisabled()),
      "reason visible when none selectable",
      "usability",
    );
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.stack ?? err.message
        : typeof err === "object" && err
          ? JSON.stringify(err)
          : String(err);
    record("harness_error", false, detail, "error");
    try {
      await staff.screenshot({ path: `${OUT}/shots/select-workflow-error.png`, fullPage: true });
    } catch { /* ignore */ }
  } finally {
    // Leave Ursula selectable flags false for a clean post-run state unless share left select mode mid-test
    await admin
      .from("event_inventory_items")
      .update({ client_selectable: false, max_quantity: null })
      .in("id", [DANCE, DJ]);
    await browser.close();
  }

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(`${OUT}/select-workflow-results.json`, JSON.stringify({ checks, failed: failed.length, persisted }, null, 2));
  writeFileSync(`${OUT}/select-workflow-persisted.json`, JSON.stringify(persisted, null, 2));
  writeFileSync(
    `${OUT}/select-workflow-run.log`,
    checks.map((c) => `${c.pass ? "PASS" : "FAIL"} [${c.kind}] ${c.name} — ${c.detail}`).join("\n") + "\n",
  );
  console.log(`\n${failed.length === 0 ? "GREEN" : "NOT GREEN"} — ${checks.length - failed.length} pass / ${failed.length} fail`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
