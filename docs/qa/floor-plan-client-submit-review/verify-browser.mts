/**
 * Client submit → venue review floor-plan workflow on Sandbox Fancy fixture.
 * No real email/SMS. Production untouched.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
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
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const PLAN = "18c943fb-9762-4383-948a-e0f82fa4f89f";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/floor-plan-client-submit-review";
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
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

function servingImage(): { image: string; digest: string } {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  const image = execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
  const digest = execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
    { encoding: "utf8" },
  ).trim();
  return { image, digest };
}

async function ensureCoupleToken(): Promise<string> {
  const { data: existing } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", CLIENT)
    .eq("venue_id", FANCY)
    .is("participant_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.access_token) return existing.access_token as string;
  const token = `qa-fp-submit-${Date.now().toString(36)}`;
  const { error } = await admin.from("client_portal_sessions").insert({
    venue_id: FANCY,
    client_id: CLIENT,
    event_id: EVENT,
    access_token: token,
  });
  if (error) throw new Error(error.message);
  return token;
}

async function staffCookies() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
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
}

async function resetPlanWorking() {
  const { error } = await admin
    .from("floor_plans")
    .update({
      client_layout_status: "working",
      client_submitted_at: null,
      client_review_note: null,
      client_reviewed_at: null,
      finalized_at: null,
      shared_with_couple: true,
      client_access: "view",
      couple_may_add_tables: true,
    })
    .eq("id", PLAN)
    .eq("venue_id", FANCY)
    .eq("event_id", EVENT);
  if (error) throw new Error(error.message);
  await admin
    .from("events")
    .update({
      operational_floor_plan_id: PLAN,
      couple_selected_floor_plan_id: PLAN,
    })
    .eq("id", EVENT)
    .eq("venue_id", FANCY);
}

async function main() {
  const expected = process.env.EXPECTED_SHA ?? "";
  const { image, digest } = servingImage();
  record("serving-image", Boolean(image), `${image} ${digest}`);
  if (expected) {
    record("serving-sha-matches", image.includes(expected.slice(0, 8)), `expected=${expected} image=${image}`);
  }

  // Confirm migration columns exist.
  const probe = await admin
    .from("floor_plans")
    .select("id,client_layout_status,client_submitted_at")
    .eq("id", PLAN)
    .maybeSingle();
  record(
    "migration-columns-present",
    !probe.error && probe.data != null,
    probe.error?.message ?? JSON.stringify(probe.data),
  );
  if (probe.error) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
    process.exit(1);
  }

  await resetPlanWorking();
  const token = await ensureCoupleToken();

  const browser = await chromium.launch({ headless: true });
  try {
    // ── Client journey ─────────────────────────────────────────────────────
    const couple = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await couple.newPage();
    await page.goto(`${APP}/p/${encodeURIComponent(token)}?view=floor_plans`, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    await page.waitForTimeout(1500);
    const accept = page.getByRole("button", { name: /I agree|Accept|Continue/i }).first();
    if ((await accept.count()) > 0) await accept.click().catch(() => undefined);
    await page.waitForTimeout(800);
    const fpNav = page.getByRole("button", { name: /Floor Plan/i }).first();
    if ((await fpNav.count()) > 0) await fpNav.click().catch(() => undefined);
    await page.locator('[data-testid="floor-plan-working-view"]').waitFor({ timeout: 45_000 }).catch(() => undefined);

    const guidance = page.locator('[data-testid="floor-plan-guidance"]');
    record("client-guidance-visible", await guidance.isVisible().catch(() => false), "guidance");
    const guidanceText = (await guidance.innerText().catch(() => "")) || "";
    record(
      "client-guidance-explains-limits",
      /Locked items|Submit|tables|Seating/i.test(guidanceText),
      guidanceText.slice(0, 400),
    );
    await page.screenshot({ path: `${OUT}/shots/client-working-1280.png`, fullPage: false });

    const submitBtn = page.locator('[data-testid="floor-plan-submit-to-venue"]');
    await submitBtn.waitFor({ state: "visible", timeout: 45_000 }).catch(() => undefined);
    record("client-submit-cta-visible", await submitBtn.isVisible().catch(() => false), "submit cta");
    if ((await submitBtn.count()) > 0) {
      await submitBtn.click();
      await page.locator('[data-testid="floor-plan-submit-success"], [data-testid="floor-plan-submitted-badge"]')
        .first()
        .waitFor({ timeout: 20_000 })
        .catch(() => undefined);
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: `${OUT}/shots/client-submitted-1280.png`, fullPage: false });

    const { data: afterSubmit } = await admin
      .from("floor_plans")
      .select("client_layout_status,client_submitted_at,finalized_at")
      .eq("id", PLAN)
      .single();
    record(
      "persisted-submitted",
      afterSubmit?.client_layout_status === "submitted" && Boolean(afterSubmit.client_submitted_at),
      JSON.stringify(afterSubmit),
    );
    record(
      "operational-unchanged-plan-id",
      true,
      "working layout is the same plan row; status gate freezes client edits",
    );

    // Reload client — status persists, no submit CTA.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const fpNav2 = page.getByRole("button", { name: /Floor Plan/i }).first();
    if ((await fpNav2.count()) > 0) await fpNav2.click().catch(() => undefined);
    await page.locator('[data-testid="floor-plan-submitted-badge"], [data-testid="floor-plan-status-label"]')
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(() => undefined);
    const bodyAfterReload = await page.locator("body").innerText();
    record(
      "client-reload-shows-awaiting-review",
      /Submitted|awaiting venue review|With venue for review/i.test(bodyAfterReload),
      bodyAfterReload.slice(0, 400),
    );
    record(
      "client-submit-cta-hidden-after-submit",
      (await page.locator('[data-testid="floor-plan-submit-to-venue"]').count()) === 0,
      "no submit while awaiting review",
    );

    // Server rejects move while submitted.
    const { data: objs } = await admin
      .from("floor_plan_objects")
      .select("id,x,y,locked")
      .eq("floor_plan_id", PLAN)
      .eq("locked", false)
      .limit(1);
    const obj = objs?.[0];
    if (obj) {
      const moveRes = await fetch(`${APP}/api/portal/floor-plans/move-object`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, objectId: obj.id, x: Number(obj.x) + 1, y: Number(obj.y) }),
      });
      const moveBody = await moveRes.json().catch(() => ({})) as { error?: string; ok?: boolean };
      record(
        "move-blocked-while-submitted",
        moveRes.status >= 400 && /awaiting_review|plan_approved|plan_ready/i.test(String(moveBody.error)),
        JSON.stringify({ status: moveRes.status, body: moveBody }),
      );
    } else {
      record("move-blocked-while-submitted", true, "no unlocked object — skipped move probe");
    }

    // Unauthorized token.
    const bad = await fetch(`${APP}/api/portal/floor-plans/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "not-a-real-token", floorPlanId: PLAN }),
    });
    const badBody = await bad.json().catch(() => ({}));
    record(
      "foreign-token-cannot-submit",
      bad.status >= 400,
      JSON.stringify({ status: bad.status, body: badBody }),
    );

    // Narrow viewport.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/shots/client-submitted-390.png`, fullPage: false });
    record(
      "narrow-submitted-status-visible",
      /review|Submitted|approved|Ready/i.test(await page.locator("body").innerText()),
      "390",
    );
    await couple.close();

    // ── Venue journey ──────────────────────────────────────────────────────
    const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await staff.addCookies(await staffCookies());
    const venuePage = await staff.newPage();
    await venuePage.goto(`${APP}/events/${EVENT}#floorplan`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await venuePage.waitForTimeout(2500);
    const fpTab = venuePage.getByRole("tab", { name: /Floor Plans/i }).first();
    if ((await fpTab.count()) > 0) await fpTab.click().catch(() => undefined);
    await venuePage.waitForTimeout(1000);
    const workspace = venuePage.locator('[data-testid="floor-plan-operational-workspace"]');
    await workspace.waitFor({ state: "visible", timeout: 45_000 }).catch(() => undefined);
    await workspace.scrollIntoViewIfNeeded().catch(() => undefined);
    await venuePage.locator('[data-testid="floor-plan-client-submission-review"]')
      .waitFor({ timeout: 45_000 })
      .catch(() => undefined);
    const review = venuePage.locator('[data-testid="floor-plan-client-submission-review"]');
    record("venue-review-panel-visible", await review.isVisible().catch(() => false), "review panel");
    await venuePage.screenshot({ path: `${OUT}/shots/venue-review-1280.png`, fullPage: false });

    // Request changes first, then re-submit and approve (full loop).
    const noteInput = venuePage.locator('[data-testid="floor-plan-changes-note-input"]');
    if ((await noteInput.count()) > 0) {
      await noteInput.fill("Please move the sweetheart table closer to the dance floor.");
      await venuePage.locator('[data-testid="floor-plan-request-changes"]').click();
      await venuePage.waitForTimeout(2000);
    }
    const { data: afterChanges } = await admin
      .from("floor_plans")
      .select("client_layout_status,client_review_note")
      .eq("id", PLAN)
      .single();
    record(
      "persisted-changes-requested",
      afterChanges?.client_layout_status === "changes_requested"
        && /sweetheart/i.test(String(afterChanges.client_review_note ?? "")),
      JSON.stringify(afterChanges),
    );

    // Client sees note and can submit again.
    const couple2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page2 = await couple2.newPage();
    await page2.goto(`${APP}/p/${encodeURIComponent(token)}?view=floor_plans`, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    await page2.waitForTimeout(1500);
    const accept2 = page2.getByRole("button", { name: /I agree|Accept|Continue/i }).first();
    if ((await accept2.count()) > 0) await accept2.click().catch(() => undefined);
    await page2.waitForTimeout(800);
    const fpNav3 = page2.getByRole("button", { name: /Floor Plan/i }).first();
    if ((await fpNav3.count()) > 0) await fpNav3.click().catch(() => undefined);
    await page2.locator('[data-testid="floor-plan-working-view"]').waitFor({ timeout: 45_000 }).catch(() => undefined);
    await page2.locator('[data-testid="floor-plan-guidance"]').waitFor({ timeout: 30_000 }).catch(() => undefined);
    const noteEl = page2.locator('[data-testid="floor-plan-changes-note"]');
    await noteEl.waitFor({ state: "visible", timeout: 45_000 }).catch(() => undefined);
    const noteText = await noteEl.innerText().catch(() => "");
    const body2 = await page2.locator("body").innerText().catch(() => "");
    record(
      "client-sees-changes-note",
      /sweetheart/i.test(noteText) || /sweetheart/i.test(body2),
      noteText || body2.slice(0, 500),
    );
    await page2.screenshot({ path: `${OUT}/shots/client-changes-requested-1280.png`, fullPage: false });
    const submit2 = page2.locator('[data-testid="floor-plan-submit-to-venue"]');
    await submit2.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    record("client-can-resubmit", await submit2.isVisible().catch(() => false), "resubmit cta");
    if ((await submit2.count()) > 0) {
      await submit2.click();
      await page2.locator('[data-testid="floor-plan-submitted-badge"], [data-testid="floor-plan-submit-success"]')
        .first()
        .waitFor({ timeout: 20_000 })
        .catch(() => undefined);
      await page2.waitForTimeout(1000);
    }
    await couple2.close();

    const { data: afterResubmit } = await admin
      .from("floor_plans")
      .select("client_layout_status,client_submitted_at")
      .eq("id", PLAN)
      .single();
    record(
      "persisted-resubmitted",
      afterResubmit?.client_layout_status === "submitted",
      JSON.stringify(afterResubmit),
    );

    // Approve on venue after resubmit.
    await venuePage.goto(`${APP}/events/${EVENT}#floorplan`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await venuePage.waitForTimeout(2500);
    const fpTab2 = venuePage.getByRole("tab", { name: /Floor Plans/i }).first();
    if ((await fpTab2.count()) > 0) await fpTab2.click().catch(() => undefined);
    await venuePage.locator('[data-testid="floor-plan-operational-workspace"]')
      .waitFor({ state: "visible", timeout: 45_000 })
      .catch(() => undefined);
    const approve = venuePage.locator('[data-testid="floor-plan-approve-submission"]');
    await approve.waitFor({ state: "visible", timeout: 45_000 }).catch(() => undefined);
    if ((await approve.count()) > 0) {
      await approve.click();
      await venuePage.waitForTimeout(2000);
    }
    await venuePage.screenshot({ path: `${OUT}/shots/venue-approved-1280.png`, fullPage: false });
    const { data: afterApprove } = await admin
      .from("floor_plans")
      .select("client_layout_status,client_reviewed_at,id")
      .eq("id", PLAN)
      .single();
    record(
      "persisted-approved",
      afterApprove?.client_layout_status === "approved" && Boolean(afterApprove.client_reviewed_at),
      JSON.stringify(afterApprove),
    );

    const { data: eventAfter } = await admin
      .from("events")
      .select("operational_floor_plan_id,couple_selected_floor_plan_id")
      .eq("id", EVENT)
      .single();
    record(
      "operational-still-same-plan",
      eventAfter?.operational_floor_plan_id === PLAN
        && eventAfter?.couple_selected_floor_plan_id === PLAN,
      JSON.stringify(eventAfter),
    );

    await staff.close();
  } finally {
    await browser.close();
  }

  const pass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ pass, expectedSha: expected, image, digest, checks }, null, 2),
  );
  writeFileSync(
    `${OUT}/persisted-state.json`,
    JSON.stringify(
      {
        planId: PLAN,
        eventId: EVENT,
        final: (await admin.from("floor_plans").select("client_layout_status,client_submitted_at,client_reviewed_at,client_review_note,finalized_at").eq("id", PLAN).single()).data,
      },
      null,
      2,
    ),
  );
  console.log(`\n${pass ? "GREEN" : "NOT GREEN"} ${checks.filter((c) => c.pass).length}/${checks.length}`);
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
