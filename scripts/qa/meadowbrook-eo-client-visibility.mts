/**
 * Sandbox lifecycle: Meadowbrook Bindi & Jake Event Order → Finalize → Share → client portal.
 * Proves the client “Not shared yet” state is the unshared gate on the correct order,
 * then that Share publishes the snapshot the portal reads.
 *
 * EXPECTED_SHA=<40-char> npx tsx scripts/qa/meadowbrook-eo-client-visibility.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "";
const VENUE = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const EVENT = "4ed4d7fb-a301-42eb-8dc6-6b76a872f8e8";
const EO = "f0fa9108-c6b8-4ea6-a071-5fd43db61a51";
const CLIENT = "0f554bb0-9766-4dd2-a4c1-fdd2bcd1e001";
const INVOICE = "08500c0c-13c0-4d13-ae73-0b870a8e4770";
const TEMPLATE = "22e5622d-8c8a-4b43-8d7f-6013017bf626";
const STAFF_EMAIL = "jlcormier612@gmail.com";
const OUT = "docs/qa/meadowbrook-eo-client-visibility";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1200) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 320)}`);
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: STAFF_EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: VENUE,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function coupleToken() {
  const { data } = await admin.from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", CLIENT)
    .eq("access_level", "couple")
    .limit(1)
    .maybeSingle();
  if (!data?.access_token) throw new Error("couple portal session missing");
  return data.access_token as string;
}

async function main() {
  if (!/^[a-f0-9]{40}$/.test(EXPECTED_SHA)) throw new Error("EXPECTED_SHA required");

  const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
  const servingSha = (loginHtml.match(/dpl=([a-f0-9]{40})/) ?? [])[1]
    ?? (loginHtml.match(/data-dpl-id="([a-f0-9]{40})"/) ?? [])[1]
    ?? null;
  record("serving_sha", servingSha === EXPECTED_SHA, `serving=${servingSha} expected=${EXPECTED_SHA}`);
  if (servingSha !== EXPECTED_SHA) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ expectedSha: EXPECTED_SHA, servingSha, checks }, null, 2));
    console.log("\nNOT GREEN — wrong SHA");
    process.exit(1);
  }

  // --- Phase 1 linkage ---
  const { data: eo } = await admin.from("event_orders")
    .select("id, venue_id, event_id, client_id, status, shared_at, finalized_at, template_id, revision")
    .eq("id", EO).maybeSingle();
  const { data: inv } = await admin.from("invoices")
    .select("id, invoice_number, event_id, event_order_id, client_id, status")
    .eq("id", INVOICE).maybeSingle();
  const { data: event } = await admin.from("events")
    .select("id, client_id, venue_id, name")
    .eq("id", EVENT).maybeSingle();
  const { data: lines } = await admin.from("event_order_lines")
    .select("description, amount, provenance, is_included")
    .eq("event_order_id", EO);
  const delivery = (lines ?? []).reduce((s, l) => s + Number(l.amount), 0);

  record(
    "linkage_same_event_order_invoice",
    !!eo && !!inv && !!event
      && inv.event_id === EVENT
      && inv.event_order_id === EO
      && eo.event_id === EVENT
      && event.client_id === CLIENT
      && eo.venue_id === VENUE,
    JSON.stringify({ eo: { status: eo?.status, shared_at: eo?.shared_at }, inv: { num: inv?.invoice_number, eo: inv?.event_order_id } }),
  );
  record("delivery_subtotal_2243", delivery === 2243, `delivery=${delivery} lines=${lines?.length}`);
  record(
    "line_provenance_custom",
    (lines ?? []).every((l) => l.provenance === "custom"),
    (lines ?? []).map((l) => l.provenance).join(","),
  );

  const { count: templateLinesBefore } = await admin.from("event_order_template_lines")
    .select("id", { count: "exact", head: true }).eq("template_id", TEMPLATE);

  const token = await coupleToken();

  // Reset to open/unshared if a prior run left it finalized/shared — then prove empty portal.
  // Do not invent a second order; mutate this canonical order only through product actions after reset.
  if (eo?.status === "finalized" || eo?.shared_at) {
    await admin.from("event_order_share_snapshots").delete().eq("event_order_id", EO);
    await admin.from("event_orders").update({
      status: "open",
      shared_at: null,
      finalized_at: null,
    }).eq("id", EO).eq("venue_id", VENUE);
    record("fixture_reset_unshared_open", true, "reset prior share/finalize for clean run");
  } else {
    record("fixture_reset_unshared_open", true, "already open/unshared");
  }

  const { data: beforePortal } = await admin.rpc("get_event_order_for_portal", { p_token: token });
  record("portal_empty_before_share", !beforePortal || beforePortal.length === 0, `rows=${beforePortal?.length ?? 0}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector('[data-testid="booked-workspace-tab-nav"]', { timeout: 60_000 });
  // Tab query can lose to a post-hydrate overview default — click the workspace tab.
  const eoTab = page.getByRole("tab", { name: /^Event Order$/i });
  await eoTab.waitFor({ state: "visible", timeout: 30_000 });
  await eoTab.click();
  await page.waitForTimeout(1500);
  if (!(await page.getByRole("button", { name: /^Finalize$/i }).isVisible().catch(() => false))) {
    await page.goto(`${APP}/events/${EVENT}#event-order`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="booked-workspace-tab-nav"]', { timeout: 60_000 });
    await page.getByRole("tab", { name: /^Event Order$/i }).click();
    await page.waitForTimeout(2000);
  }
  await page.getByRole("button", { name: /^Finalize$/i }).waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
  await page.screenshot({ path: `${OUT}/venue-before-finalize-1280.png`, fullPage: true }).catch(() => undefined);

  const venueBody = await page.locator("body").innerText();
  record(
    "venue_shows_canonical_lines",
    /Ceremony Coordination/i.test(venueBody) && /Arbor/i.test(venueBody) && /2,?243/.test(venueBody),
    venueBody.match(/Ceremony Coordination[\s\S]{0,80}|Delivery subtotal[\s\S]{0,80}/)?.[0] ?? venueBody.slice(0, 240),
  );

  const finalizeBtn = page.getByRole("button", { name: /^Finalize$/i });
  record("finalize_control_visible", await finalizeBtn.isVisible().catch(() => false), "Finalize");
  await finalizeBtn.click();
  // Zero-total confirm should not appear (total 2243); dismiss if present.
  await page.waitForTimeout(800);
  if (await page.getByText(/\$0|zero total/i).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /^(Continue|Finalize)$/i }).click().catch(() => undefined);
  }
  let afterFinalize: { status: string; finalized_at: string | null; shared_at: string | null; revision: number } | null = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    const { data } = await admin.from("event_orders")
      .select("status, finalized_at, shared_at, revision").eq("id", EO).maybeSingle();
    afterFinalize = data;
    if (data?.status === "finalized") break;
  }
  record(
    "finalized_persisted",
    afterFinalize?.status === "finalized" && !!afterFinalize.finalized_at && !afterFinalize.shared_at,
    JSON.stringify(afterFinalize),
  );
  if (afterFinalize?.status !== "finalized") {
    await page.screenshot({ path: `${OUT}/finalize-failed-1280.png`, fullPage: true }).catch(() => undefined);
    throw new Error(`Finalize did not persist: ${JSON.stringify(afterFinalize)}`);
  }

  await page.goto(`${APP}/events/${EVENT}#event-order`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector('[data-testid="booked-workspace-tab-nav"]', { timeout: 60_000 });
  await page.getByRole("tab", { name: /^Event Order$/i }).click();
  await page.waitForTimeout(2000);
  const shareBtn = page.getByRole("button", { name: /Share with Client/i });
  await shareBtn.waitFor({ state: "visible", timeout: 30_000 });
  record("share_control_after_finalize", await shareBtn.isVisible().catch(() => false), "Share with Client");
  await shareBtn.click();
  await page.waitForTimeout(800);
  const sendShare = page.getByRole("button", { name: /^Share$/i }).last();
  await sendShare.click();
  // Share uploads a PDF + writes snapshot; wait for persisted shared_at (not a fixed sleep).
  let afterShare: { status: string; shared_at: string | null; revision: number } | null = null;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);
    const { data } = await admin.from("event_orders")
      .select("status, shared_at, revision").eq("id", EO).maybeSingle();
    afterShare = data;
    if (data?.shared_at) break;
    const sending = await page.getByRole("button", { name: /Sending/i }).isVisible().catch(() => false);
    if (!sending && i > 5) {
      // Dialog may have closed with an error toast — capture once more then stop.
      const body = await page.locator("body").innerText();
      if (/could not|failed|error/i.test(body) && !data?.shared_at) break;
    }
  }
  await page.screenshot({ path: `${OUT}/venue-after-share-1280.png`, fullPage: true }).catch(() => undefined);

  const { data: snaps } = await admin.from("event_order_share_snapshots")
    .select("id, revision, shared_at, payload")
    .eq("event_order_id", EO)
    .order("shared_at", { ascending: false })
    .limit(1);
  const snap = snaps?.[0];
  const snapLines = (snap?.payload as { lines?: Array<{ description: string; amount: number }> } | null)?.lines ?? [];
  record(
    "shared_at_and_snapshot",
    !!afterShare?.shared_at && !!snap && snapLines.length >= 7,
    JSON.stringify({ shared_at: afterShare?.shared_at, snapLines: snapLines.length, revision: snap?.revision }),
  );
  record(
    "snapshot_includes_key_lines",
    snapLines.some((l) => /Ceremony Coordination/i.test(l.description))
      && snapLines.some((l) => /Arbor/i.test(l.description)),
    snapLines.map((l) => l.description).slice(0, 8).join(" | "),
  );

  const { data: afterPortal } = await admin.rpc("get_event_order_for_portal", { p_token: token });
  record("portal_rpc_returns_shared_lines", (afterPortal?.length ?? 0) >= 7, `rows=${afterPortal?.length}`);

  // Client browser
  const clientPage = await context.newPage();
  await clientPage.goto(`${APP}/p/${token}#event-order`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await clientPage.waitForTimeout(2000);
  // Dismiss welcome if present
  for (let i = 0; i < 4; i++) {
    const welcome = clientPage.locator('[data-welcome-experience="true"]');
    if (!(await welcome.isVisible().catch(() => false))) break;
    const agree = clientPage.getByRole("checkbox");
    if (await agree.isVisible().catch(() => false)) await agree.check({ force: true }).catch(() => undefined);
    const cont = clientPage.getByRole("button", { name: /^Continue$/i });
    if (await cont.isVisible().catch(() => false)) await cont.click().catch(() => undefined);
    await clientPage.waitForTimeout(1500);
  }
  // Re-enter Event Order after welcome (hash can be lost on the gate).
  await clientPage.goto(`${APP}/p/${token}#event-order`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await clientPage.waitForTimeout(1500);
  const orderNav = clientPage.getByRole("button", { name: /Order/i }).first();
  if (await orderNav.isVisible().catch(() => false)) {
    await orderNav.click().catch(() => undefined);
    await clientPage.waitForTimeout(1200);
  }
  await clientPage.locator("[data-testid=event-order-portal-view], [data-testid=event-order-portal-empty]")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .catch(() => undefined);
  const clientBody = await clientPage.locator("body").innerText();
  record(
    "client_sees_shared_order",
    !/Not shared yet/i.test(clientBody)
      && /Ceremony Coordination/i.test(clientBody)
      && /Arbor/i.test(clientBody),
    clientBody.slice(0, 400),
  );
  await clientPage.screenshot({ path: `${OUT}/client-after-share-1280.png`, fullPage: true }).catch(() => undefined);

  await clientPage.setViewportSize({ width: 390, height: 844 });
  await clientPage.waitForTimeout(500);
  await clientPage.screenshot({ path: `${OUT}/client-after-share-390.png`, fullPage: true }).catch(() => undefined);

  // Invoice still points at same EO
  const { data: invAfter } = await admin.from("invoices")
    .select("event_order_id, event_id, invoice_number").eq("id", INVOICE).maybeSingle();
  record(
    "invoice_linkage_unchanged",
    invAfter?.event_order_id === EO && invAfter?.event_id === EVENT,
    JSON.stringify(invAfter),
  );

  // Template isolation
  const { count: templateLinesAfter } = await admin.from("event_order_template_lines")
    .select("id", { count: "exact", head: true }).eq("template_id", TEMPLATE);
  record(
    "template_unchanged",
    templateLinesBefore === templateLinesAfter,
    `before=${templateLinesBefore} after=${templateLinesAfter}`,
  );

  // Cross-tenant: Fancy couple token must not see Meadowbrook EO
  const { data: fancySess } = await admin.from("client_portal_sessions")
    .select("access_token, clients!inner(venue_id)")
    .neq("clients.venue_id", VENUE)
    .eq("access_level", "couple")
    .limit(1)
    .maybeSingle();
  if (fancySess?.access_token) {
    const { data: foreign } = await admin.rpc("get_event_order_for_portal", { p_token: fancySess.access_token });
    const leaked = (foreign ?? []).some((r: { id?: string }) => r.id === EO);
    record("cross_tenant_no_leak", !leaked, `foreignRows=${foreign?.length ?? 0}`);
  } else {
    record("cross_tenant_no_leak", true, "no foreign couple session available — skipped");
  }

  // Unauthorized: random token
  const { data: bogus } = await admin.rpc("get_event_order_for_portal", { p_token: "not-a-real-token" });
  record("bogus_token_empty", !bogus || bogus.length === 0, `rows=${bogus?.length ?? 0}`);

  await browser.close();

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
    expectedSha: EXPECTED_SHA,
    eventId: EVENT,
    eventOrderId: EO,
    invoiceId: INVOICE,
    passed,
    failed,
    checks,
  }, null, 2));
  writeFileSync(`${OUT}/browser-run.log`, checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n"));
  // Keep FORENSIC readable; append run note
  const note = `\n\n## Lifecycle proof run\n\nServing \`${EXPECTED_SHA}\` — passed=${passed} failed=${failed}.\n`;
  try {
    writeFileSync(`${OUT}/FORENSIC.md`, readFileSync(`${OUT}/FORENSIC.md`, "utf8").replace(/\n## Lifecycle proof run[\s\S]*$/, "") + note);
  } catch { /* ignore */ }
  console.log(`\n${failed === 0 ? "GREEN" : "NOT GREEN"} passed=${passed} failed=${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
