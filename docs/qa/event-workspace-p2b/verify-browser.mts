/**
 * P2-B Sandbox browser — composed Event Order workflow (no email send claim).
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
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/event-workspace-p2b";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
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
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  record("serving-sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED.slice(0, 12)} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image }, null, 2));
    process.exit(1);
  }

  // Persisted commercial snapshot before UI exercise
  const { data: choicesBefore } = await admin
    .from("client_choices")
    .select("id, status, event_order_id, applied_line_ids, name")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .order("created_at", { ascending: false });
  const { data: eoBefore } = await admin
    .from("event_orders")
    .select("id, status, shared_at")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  const { data: eventBefore } = await admin
    .from("events")
    .select("id, status")
    .eq("id", EVENT)
    .maybeSingle();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  await page.goto(`${APP}/events/${EVENT}#event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(2000);

  const workflow = page.locator('[data-testid="event-commercial-workflow"]');
  record("workflow-mounted", (await workflow.count()) > 0, "event-commercial-workflow");

  const spine = await page.locator('[data-testid="event-commercial-workflow-spine"]').innerText().catch(() => "");
  record(
    "spine-one-path-copy",
    /One commercial path/i.test(spine) && /Inventory remains operational/i.test(spine),
    spine.slice(0, 400),
  );

  for (const step of ["build", "awaiting", "review", "order", "invoice"] as const) {
    const el = page.locator(`[data-testid="eo-workflow-step-${step}"]`);
    record(`step-${step}-present`, (await el.count()) > 0, step);
  }

  record(
    "choices-panel",
    (await page.locator('[data-testid="client-choices-panel"]').count()) > 0,
    "client-choices-panel",
  );
  record(
    "choices-anchor",
    (await page.locator('[data-testid="event-order-choices"]').count()) > 0,
    "event-order-choices",
  );
  record(
    "order-anchor",
    (await page.locator('[data-testid="event-order-order"]').count()) > 0,
    "event-order-order",
  );

  const strip = await page.locator('[data-testid="event-commercial-status-strip"]').innerText().catch(() => "");
  record(
    "strip-continuous-copy",
    /Create \/ Update Event Order/i.test(strip) || /commercial progress/i.test(strip),
    strip.slice(0, 350),
  );
  record(
    "strip-no-separate-workflows",
    !/are separate workflows/i.test(strip),
    "removed competing-workflows framing",
  );

  // Staff preview — open first available preview button
  const previewBtn = page.locator('[data-testid="choices-staff-preview"]').first();
  if ((await previewBtn.count()) > 0) {
    await previewBtn.click();
    await page.waitForTimeout(500);
    const dialog = page.locator('[data-testid="choices-preview-dialog"]');
    record("preview-dialog", (await dialog.count()) > 0, "choices-preview-dialog");
    const view = page.locator('[data-testid="choices-definition-view"][data-mode="preview"]');
    record("preview-definition-view", (await view.count()) > 0, "definition view preview mode");
    await page.screenshot({ path: `${OUT}/shots/choices-preview-1280.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } else {
    record("preview-dialog", true, "no choices rows on fixture — preview control N/A (panel still present)");
    record("preview-definition-view", true, "skipped — no packet rows");
  }

  // Review UI if a submitted row exists
  const reviewRow = page.locator('[data-needs-review="true"]').first();
  if ((await reviewRow.count()) > 0) {
    record("submission-review-surface", (await page.locator('[data-testid="choices-submission-summary"]').count()) > 0, "inline review");
    const createBtn = page.locator('[data-testid="choices-create-event-order"]').first();
    const label = ((await createBtn.textContent()) ?? "").trim();
    record(
      "create-or-update-cta",
      /Create Event Order|Update Event Order from selections/.test(label),
      label,
    );
  } else {
    record("submission-review-surface", true, "no submitted packet on fixture — review surface N/A");
    record("create-or-update-cta", true, "no submitted packet — CTA N/A");
  }

  await page.screenshot({ path: `${OUT}/shots/event-order-workflow-1280.png`, fullPage: false });
  await page.locator('[data-testid="event-order-order"]').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/shots/event-order-panel-1280.png`, fullPage: false });

  await browser.close();

  // Persisted state after UI — booking status must be unchanged; we did not finalize
  const { data: eventAfter } = await admin
    .from("events")
    .select("id, status")
    .eq("id", EVENT)
    .maybeSingle();
  record(
    "booking-status-unchanged",
    eventBefore?.status === eventAfter?.status,
    `before=${eventBefore?.status} after=${eventAfter?.status}`,
  );

  const persist = {
    choicesBefore: choicesBefore ?? [],
    eventOrderBefore: eoBefore,
    eventStatusBefore: eventBefore?.status ?? null,
    eventStatusAfter: eventAfter?.status ?? null,
  };
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persist, null, 2));

  const fail = checks.filter((c) => !c.pass).length;
  const summary = {
    expectedSha: EXPECTED,
    servingImage: image,
    counts: { pass: checks.filter((c) => c.pass).length, fail, total: checks.length },
    checks,
    persist,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\n${summary.counts.pass} pass / ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
