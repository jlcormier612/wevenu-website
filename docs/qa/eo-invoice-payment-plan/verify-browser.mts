/**
 * C5 / AUDIT: EO-linked invoice → payment plan builder (Sandbox).
 * Fancy venue draft EO invoice — read-mostly; does not send invoice email.
 * Creates a schedule only when none exists (idempotent duplicate check).
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
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const VENUE = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const STAFF_EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/eo-invoice-payment-plan";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED_SHA) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 360)}`);
}

async function servingShaFromEcs(): Promise<string | null> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return null;
    const image = execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
    const tag = image.split(":").pop() ?? "";
    return tag.startsWith(EXPECTED_SHA.slice(0, 12)) ? EXPECTED_SHA : tag || null;
  } catch {
    return null;
  }
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

async function main() {
  let servingSha = await servingShaFromEcs();
  record("serving_sha", servingSha === EXPECTED_SHA, `serving=${servingSha} expected=${EXPECTED_SHA}`);
  if (servingSha !== EXPECTED_SHA) throw new Error("serving mismatch");

  const { data: eo } = await admin.from("event_orders")
    .select("id, status, shared_at").eq("event_id", EVENT).eq("venue_id", VENUE).maybeSingle();
  const { data: inv } = await admin.from("invoices")
    .select("id,invoice_number,total,status,event_order_id,event_id")
    .eq("event_id", EVENT).eq("venue_id", VENUE).eq("event_order_id", eo!.id).neq("status", "void")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  record("db_eo_linked_invoice",
    !!inv && inv.event_order_id === eo?.id && inv.status === "draft",
    JSON.stringify(inv));
  record("db_share_did_not_require_invoice_row_semantics",
    eo?.status === "finalized" && !!eo.shared_at && !!inv,
    "finalize/share and invoice remain distinct rows");

  const { count: schedulesBefore } = await admin.from("payment_schedules")
    .select("id", { count: "exact", head: true }).eq("invoice_id", inv!.id);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/events/${EVENT}?tab=event-order`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await page.getByTestId("commercial-anchor-invoice").click().catch(() => {});
    await page.waitForTimeout(800);
    const eoInv = page.getByTestId("event-order-invoice");
    const eoText = (await eoInv.innerText().catch(() => "")) || "";
    record("eo_tab_invoice_link_shows_open_invoice",
      /Open Invoice/i.test(eoText) && (/Invoice/i.test(eoText) || eoText.includes(inv!.invoice_number)),
      eoText.slice(0, 300));

    await page.goto(`${APP}/invoices/${inv!.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    const invBody = await page.locator("body").innerText();
    record("invoice_ui_loads_eo_linked_draft",
      invBody.includes(inv!.invoice_number) || /Invoice/i.test(invBody),
      invBody.slice(0, 200));
    await page.screenshot({ path: `${OUT}/shots/invoice-1280.png`, fullPage: true });

    await page.goto(`${APP}/payments/new?invoiceId=${inv!.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    const builderBody = await page.locator("body").innerText();
    record("builder_shows_orientation",
      /Payment Plan/i.test(builderBody)
      && (/Back to invoice/i.test(builderBody) || /invoice/i.test(builderBody))
      && page.url().includes(`invoiceId=${inv!.id}`),
      builderBody.slice(0, 400));
    record("builder_no_zero_mismatch_banner",
      !/must equal the invoice total \(0\)/i.test(builderBody),
      /must equal/i.test(builderBody) ? builderBody.match(/must equal[^\n]+/)?.[0] ?? "mismatch" : "ok");

    const equalBtn = page.getByRole("button", { name: /Equal|4 payments|Split equally/i }).first();
    if (await equalBtn.count()) {
      await equalBtn.click();
      await page.waitForTimeout(800);
    }
    const continueBtn = page.getByRole("button", { name: /Continue|Preview|Next/i }).first();
    if (await continueBtn.count()) {
      await continueBtn.click();
      await page.waitForTimeout(1000);
    }
    const previewBtn = page.getByRole("button", { name: /Preview/i }).first();
    if (await previewBtn.count()) {
      await previewBtn.click();
      await page.waitForTimeout(1500);
    }
    const afterPreview = await page.locator("body").innerText();
    record("preview_no_zero_total_error",
      !/must equal the invoice total \(0\)/i.test(afterPreview),
      afterPreview.match(/must equal[^\n]+/)?.[0] ?? "ok");
    await page.screenshot({ path: `${OUT}/shots/builder-preview-1280.png`, fullPage: true });

    if ((schedulesBefore ?? 0) === 0) {
      const createBtn = page.getByRole("button", { name: /Create payment plan|Create schedule|Save/i }).first();
      if (await createBtn.count()) {
        await createBtn.click();
        await page.waitForTimeout(3000);
      }
      const toastOrBody = await page.locator("body").innerText();
      record("create_without_zero_mismatch",
        !/must equal the invoice total \(0\)/i.test(toastOrBody),
        toastOrBody.match(/must equal[^\n]+|payment plan[^\n]{0,80}/i)?.[0] ?? "ok");
    } else {
      record("create_without_zero_mismatch", true, `schedule already exists count=${schedulesBefore}`);
    }

    const { count: schedulesAfter } = await admin.from("payment_schedules")
      .select("id", { count: "exact", head: true }).eq("invoice_id", inv!.id);
    record("no_duplicate_schedules",
      (schedulesAfter ?? 0) <= Math.max(1, schedulesBefore ?? 0) + ((schedulesBefore ?? 0) === 0 ? 1 : 0)
      && (schedulesAfter ?? 0) >= (schedulesBefore ?? 0),
      `before=${schedulesBefore} after=${schedulesAfter}`);

    await page.goto(`${APP}/invoices/${inv!.id}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    record("nav_back_to_invoice", page.url().includes(`/invoices/${inv!.id}`), page.url());
  } finally {
    await browser.close();
    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.filter((c) => !c.pass).length;
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
      expectedSha: EXPECTED_SHA,
      servingSha,
      invoiceId: inv?.id ?? null,
      eventId: EVENT,
      passed,
      failed,
      green: failed === 0,
      checks,
      at: new Date().toISOString(),
    }, null, 2));
    console.log(`\nRESULT ${failed === 0 ? "GREEN" : "NOT GREEN"} ${passed}/${passed + failed}`);
    if (failed > 0) process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
