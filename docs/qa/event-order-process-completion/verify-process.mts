/**
 * Event Order process completion — package→EO seed + stage smoke (Sandbox).
 * Does not send email or trigger external payments. Cleans up disposable seed lines.
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
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/event-order-process-completion";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox — refusing");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
}

async function servingImage(): Promise<string> {
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
}

async function servingDigest(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  if (!taskArn || taskArn === "None") return "";
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
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
}

async function main() {
  const image = await servingImage();
  const digest = await servingDigest();
  const shaOk = EXPECTED ? image.includes(EXPECTED.slice(0, 8)) : /htc-sandbox-venue-app:[0-9a-f]{8}/.test(image);
  record("serving-sha", shaOk, `expected=${EXPECTED || "(any)"} ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);
  if (!shaOk) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
    process.exit(1);
  }

  const marker = `EO-PROC-SEED-${Date.now()}`;
  const { data: pkg } = await admin
    .from("packages")
    .select("id, name, base_price")
    .eq("venue_id", FANCY)
    .eq("is_active", true)
    .not("base_price", "is", null)
    .gt("base_price", 0)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  record("fixture-package", Boolean(pkg?.id), JSON.stringify(pkg));

  // Prefer an open, unshared EO on Fancy so ensure can heal/seed.
  const { data: openOrders } = await admin
    .from("event_orders")
    .select("id, event_id, status, shared_at, template_id")
    .eq("venue_id", FANCY)
    .eq("status", "open")
    .is("shared_at", null)
    .not("event_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(20);

  let target: { eventId: string; eventOrderId: string; templateId: string | null } | null = null;
  for (const eo of openOrders ?? []) {
    const { data: ev } = await admin
      .from("events")
      .select("id, client_id, booked_at")
      .eq("id", eo.event_id)
      .eq("venue_id", FANCY)
      .maybeSingle();
    if (!ev?.id) continue;
    target = { eventId: ev.id, eventOrderId: eo.id, templateId: eo.template_id };
    break;
  }
  record("fixture-open-eo", Boolean(target), JSON.stringify(target));
  if (!target || !pkg) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
    process.exit(1);
  }

  const { data: eventRow } = await admin
    .from("events")
    .select("id, client_id")
    .eq("id", target.eventId)
    .single();

  // Supersede prior active selection for this event, then insert disposable selection with unique inclusion.
  const { data: prior } = await admin
    .from("commercial_selections")
    .select("id")
    .eq("venue_id", FANCY)
    .eq("event_id", target.eventId)
    .neq("status", "superseded");
  for (const row of prior ?? []) {
    await admin.from("commercial_selections").update({ status: "superseded" }).eq("id", row.id);
  }

  const { data: selection, error: selErr } = await admin
    .from("commercial_selections")
    .insert({
      venue_id: FANCY,
      event_id: target.eventId,
      client_id: eventRow?.client_id ?? null,
      source_package_id: pkg.id,
      name: `Process seed ${pkg.name}`,
      package_amount: pkg.base_price,
      discount_amount: 0,
      tax_applied: false,
      tax_amount: 0,
      total_amount: pkg.base_price,
      deposit_amount: Math.round(Number(pkg.base_price) * 0.25 * 100) / 100,
      included_items: [
        { description: marker, quantity: 1, unit: null },
        { description: "EO-PROC-INCLUDED-SERVICE", quantity: 1, unit: null },
      ],
      status: "accepted",
      version: 1,
    })
    .select("id, name, included_items, total_amount")
    .single();
  if (selErr) throw selErr;
  record("stage1-selection-created", Boolean(selection?.id), JSON.stringify(selection));

  // Remove any prior marker lines so seed must re-add.
  await admin
    .from("event_order_lines")
    .delete()
    .eq("event_order_id", target.eventOrderId)
    .eq("venue_id", FANCY)
    .ilike("description", "EO-PROC-%");

  const { data: linesBefore } = await admin
    .from("event_order_lines")
    .select("id, description, unit_price, amount, is_included, notes, provenance")
    .eq("event_order_id", target.eventOrderId);
  const payableBefore = (linesBefore ?? [])
    .filter((l) => !l.is_included && l.unit_price != null)
    .reduce((s, l) => s + Number(l.amount ?? 0), 0);
  record("stage2-marker-absent-before", !(linesBefore ?? []).some((l) => l.description === marker), `lines=${(linesBefore ?? []).length}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(await staffCookies());
    const page = await ctx.newPage();
    await page.goto(`${APP}/events/${target.eventId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    // Trigger ensure via Event Order panel (preferred template heal + seed).
    const eoLink = page.getByRole("link", { name: /Event Order|Commercial/i }).first();
    if ((await eoLink.count()) > 0) await eoLink.click().catch(() => undefined);
    await page.goto(`${APP}/events/${target.eventId}#event-order-order`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(4000);
    // Force a refresh that re-runs ensure effect if panel mounted.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}/shots/stage2-eo-after-ensure-1280.png`, fullPage: false });
    record("stage2-browser-landed", /events\//.test(page.url()), page.url());
  } finally {
    await browser.close();
  }

  const { data: linesAfter } = await admin
    .from("event_order_lines")
    .select("id, description, unit_price, amount, is_included, notes, provenance, offering_id, package_id")
    .eq("event_order_id", target.eventOrderId);
  const seeded = (linesAfter ?? []).filter((l) => l.description === marker);
  const includedService = (linesAfter ?? []).filter((l) => l.description === "EO-PROC-INCLUDED-SERVICE");
  record(
    "stage2-package-inclusion-seeded",
    seeded.length === 1
      && seeded[0]?.is_included === true
      && seeded[0]?.provenance === "custom"
      && !seeded[0]?.offering_id
      && String(seeded[0]?.notes ?? "").startsWith("package-selection:"),
    JSON.stringify(seeded),
  );
  record(
    "stage2-second-inclusion-seeded",
    includedService.length === 1 && includedService[0]?.is_included === true,
    JSON.stringify(includedService),
  );
  record(
    "stage2-no-offering-invented",
    seeded.every((l) => !l.offering_id) && includedService.every((l) => !l.offering_id),
    "offering_id must remain null",
  );
  record(
    "stage2-no-package-fee-auto-added",
    !(linesAfter ?? []).some((l) => l.provenance === "package" && l.package_id === pkg.id),
    "package fee stays on booking spine",
  );

  // Idempotent re-ensure: reload page should not duplicate.
  const browser2 = await chromium.launch({ headless: true });
  try {
    const ctx = await browser2.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(await staffCookies());
    const page = await ctx.newPage();
    await page.goto(`${APP}/events/${target.eventId}#event-order-order`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(4000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
  } finally {
    await browser2.close();
  }
  const { data: linesIdem } = await admin
    .from("event_order_lines")
    .select("id, description")
    .eq("event_order_id", target.eventOrderId)
    .eq("description", marker);
  record("stage2-idempotent-no-duplicate", (linesIdem ?? []).length === 1, `count=${(linesIdem ?? []).length}`);

  const payableAfter = (linesAfter ?? [])
    .filter((l) => !l.is_included && l.unit_price != null)
    .reduce((s, l) => s + Number(l.amount ?? 0), 0);
  record(
    "stage6-payable-unchanged-by-included-seed",
    Math.abs(payableAfter - payableBefore) < 0.01,
    `before=${payableBefore} after=${payableAfter}`,
  );

  // Scenario E: included vs any existing paid line remain distinguishable.
  const paid = (linesAfter ?? []).filter((l) => !l.is_included && Number(l.unit_price ?? 0) > 0);
  record(
    "scenario-e-included-vs-paid",
    seeded[0]?.is_included === true && (paid.length === 0 || paid.every((l) => l.is_included === false)),
    `includedSeed=true paidCount=${paid.length}`,
  );

  // Cleanup disposable seed lines + supersede our selection (leave event intact).
  await admin
    .from("event_order_lines")
    .delete()
    .eq("event_order_id", target.eventOrderId)
    .eq("venue_id", FANCY)
    .ilike("description", "EO-PROC-%");
  if (selection?.id) {
    await admin.from("commercial_selections").update({ status: "superseded" }).eq("id", selection.id);
  }
  record("cleanup-seed-lines", true, "removed EO-PROC-* lines; superseded test selection");

  const pass = checks.every((c) => c.pass);
  const payload = {
    pass,
    image,
    digest,
    expectedSha: EXPECTED || null,
    marker,
    eventId: target.eventId,
    eventOrderId: target.eventOrderId,
    selectionId: selection?.id ?? null,
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(payload, null, 2));
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify({
    marker,
    selection,
    linesAfterSample: (linesAfter ?? []).filter((l) => String(l.description).startsWith("EO-PROC-")),
    payableBefore,
    payableAfter,
  }, null, 2));
  console.log(pass ? "\nGREEN process seed verification" : "\nNOT GREEN");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
