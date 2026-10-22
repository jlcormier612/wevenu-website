/**
 * Sandbox: Bindi Lulu / Meadowbrook — insurance task + venue documents + payments.
 * No real payments, emails, or re-uploads of the existing insurance file.
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
const VENUE = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const CLIENT = "0f554bb0-9766-4dd2-a4c1-fdd2bcd1e001";
const EVENT = "4ed4d7fb-a301-42eb-8dc6-6b76a872f8e8";
const INSURANCE_TASK = "f5778f89-60ee-43dd-8755-f9f200df8b43";
const COUPLE_DOC = "fa395859-7f7c-4898-a86c-bb27b12e6a0f";
const STAFF_EMAIL = "jlcormier612@gmail.com";
const OUT = "docs/qa/client-venue-task-reconciliation";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED_SHA) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 900) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 320)}`);
}

async function cookies() {
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
  let servingSha: string | null = null;

  const { data: taskBefore } = await admin.from("event_tasks").select("id,status,completed_at").eq("id", INSURANCE_TASK).maybeSingle();
  const { data: coupleBefore } = await admin.from("couple_documents").select("id,source_type,share_with_venue,file_url").eq("id", COUPLE_DOC).maybeSingle();
  const { count: docsBefore } = await admin.from("documents").select("id", { count: "exact", head: true }).eq("venue_id", VENUE).eq("event_id", EVENT).eq("category", "insurance");
  const { data: lines } = await admin.from("payment_line_items")
    .select("label,status,amount,paid_at,payment_method,quickbooks_sync_status")
    .eq("schedule_id", "bace9bbd-a462-4982-9562-b445faaf00bc")
    .order("sort_order");

  record("db_insurance_task_complete", taskBefore?.status === "complete" && !!taskBefore.completed_at, JSON.stringify(taskBefore));
  record("db_couple_insurance_persisted", coupleBefore?.source_type === "insurance" && coupleBefore.share_with_venue === true, JSON.stringify(coupleBefore));
  record("db_payment_schedule_matches_screenshot",
    (lines ?? []).length === 4
    && lines![0].label === "Initial Payment" && lines![0].status === "paid" && lines![0].payment_method === "cash"
    && lines![1].label === "Planning Payment 1" && lines![1].status === "pending"
    && lines![3].label === "Final Payment" && lines![3].status === "pending",
    JSON.stringify(lines),
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();

  try {
    for (let i = 0; i < 18; i++) {
      const res = await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      const html = await page.content();
      const link = res?.headers()["link"] ?? "";
      servingSha = html.match(/data-dpl-id="([a-f0-9]{40})"/)?.[1]
        ?? link.match(/dpl=([a-f0-9]{40})/)?.[1]
        ?? null;
      if (servingSha === EXPECTED_SHA) break;
      await page.waitForTimeout(5_000);
    }
    record("serving_sha", servingSha === EXPECTED_SHA, `serving=${servingSha} expected=${EXPECTED_SHA}`);
    if (servingSha !== EXPECTED_SHA) throw new Error("serving mismatch");

    // Client booking — Planning / tasks
    await page.goto(`${APP}/clients/${CLIENT}?event=${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    // Open Planning tab if present
    await page.getByRole("link", { name: /^Planning$/i }).click({ timeout: 8_000 }).catch(() => {});
    await page.getByRole("tab", { name: /Planning/i }).click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const planningText = await page.locator("main").innerText();
    record(
      "venue_insurance_in_completed",
      /Purchase event insurance/i.test(planningText)
        && (/Completed/i.test(planningText) || /complete/i.test(planningText)),
      planningText.slice(0, 600),
    );
    // Should not list insurance under Upcoming as incomplete — look for section structure
    const upcomingBlock = planningText.match(/Upcoming[\s\S]{0,800}?Completed/i)?.[0] ?? "";
    record(
      "venue_insurance_not_in_upcoming_block",
      !/Purchase event insurance/i.test(upcomingBlock),
      upcomingBlock.slice(0, 500) || "no upcoming→completed window",
    );
    await page.screenshot({ path: `${OUT}/shots/venue-planning-1280.png`, fullPage: true });

    // Documents tab — heal runs on load
    await page.getByRole("link", { name: /^Documents$/i }).click({ timeout: 8_000 }).catch(() => {});
    await page.getByRole("tab", { name: /Documents/i }).click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const docsText = await page.locator("main").innerText();
    record(
      "venue_documents_shows_insurance",
      /insurance|Event insurance|couple event insurance|Essential Wedding/i.test(docsText),
      docsText.slice(0, 700),
    );
    await page.screenshot({ path: `${OUT}/shots/venue-documents-1280.png`, fullPage: true });

    // Payments
    await page.getByRole("link", { name: /^Payments$/i }).click({ timeout: 8_000 }).catch(() => {});
    await page.getByRole("tab", { name: /Payments|Invoices/i }).click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const payText = await page.locator("main").innerText();
    record(
      "venue_payments_show_schedule",
      /Initial Payment|Planning Payment|Final Payment|3,?750/i.test(payText),
      payText.slice(0, 500),
    );
    await page.screenshot({ path: `${OUT}/shots/venue-payments-1280.png`, fullPage: true });

    const { count: docsAfter } = await admin.from("documents").select("id", { count: "exact", head: true })
      .eq("venue_id", VENUE).eq("event_id", EVENT).eq("category", "insurance");
    const { data: insDocs } = await admin.from("documents")
      .select("id,name,category,storage_url,notes")
      .eq("venue_id", VENUE)
      .eq("category", "insurance")
      .or(`event_id.eq.${EVENT},client_id.eq.${CLIENT}`);
    record(
      "db_insurance_document_registered",
      (docsAfter ?? 0) >= 1 || (insDocs ?? []).length >= 1,
      JSON.stringify({ docsBefore, docsAfter, insDocs }),
    );

    // Idempotent heal — reload documents, count must not grow beyond 1 for same file
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const { count: docsAfterReload } = await admin.from("documents").select("id", { count: "exact", head: true })
      .eq("venue_id", VENUE).eq("category", "insurance").eq("client_id", CLIENT);
    record(
      "db_no_duplicate_insurance_docs",
      (docsAfterReload ?? 0) <= 1,
      `count=${docsAfterReload}`,
    );

    const { data: taskAfter } = await admin.from("event_tasks").select("status,completed_at").eq("id", INSURANCE_TASK).maybeSingle();
    record("db_task_still_complete_after_refresh", taskAfter?.status === "complete", JSON.stringify(taskAfter));
  } finally {
    await browser.close();
    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.filter((c) => !c.pass).length;
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
      expectedSha: EXPECTED_SHA, servingSha, eventId: EVENT, clientId: CLIENT,
      passed, failed, green: failed === 0, checks,
    }, null, 2));
    console.log(`\nRESULT ${failed === 0 ? "GREEN" : "NOT GREEN"} ${passed}/${passed + failed}`);
    if (failed > 0) process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
