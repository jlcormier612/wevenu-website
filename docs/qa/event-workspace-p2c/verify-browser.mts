/**
 * P2-C Sandbox — ShareDialog + selection-request email (sandbox sink).
 * Does not claim inbox delivery. No P2-D/E.
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
const OUT = "docs/qa/event-workspace-p2c";
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
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
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

  const { data: eventBefore } = await admin
    .from("events")
    .select("id, status, client_id")
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

  record(
    "journey-present",
    (await page.locator('[data-testid="event-order-journey"]').count()) === 1,
    "stage0 journey retained",
  );
  record(
    "no-competing-strip",
    (await page.locator('[data-testid="event-commercial-status-strip"]').count()) === 0,
    "strip still demoted",
  );

  // Ensure a draft/sent packet exists for ShareDialog
  let sendBtn = page.locator('[data-testid="choices-send-selection-request"]').first();
  if ((await sendBtn.count()) === 0) {
    const start = page.locator('[data-testid="choices-start-selections"]');
    if ((await start.count()) > 0 && !(await start.isDisabled())) {
      await start.click();
      await page.waitForTimeout(2500);
    }
  }
  sendBtn = page.locator('[data-testid="choices-send-selection-request"]').first();
  record("send-cta-present", (await sendBtn.count()) > 0, "Send selection request");

  if ((await sendBtn.count()) === 0) {
    record("share-dialog", false, "no sendable choices packet on fixture");
    record("email-outcome", false, "blocked — no packet");
  } else {
    const { data: choicesBefore } = await admin
      .from("client_choices")
      .select("id, status, name")
      .eq("event_id", EVENT)
      .eq("venue_id", FANCY)
      .in("status", ["draft", "sent", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await sendBtn.click();
    await page.waitForTimeout(600);
    const sheet = page.locator('[data-slot="sheet-content"], [role="dialog"]').filter({
      hasText: /Send selection request|Resend selection request/i,
    });
    record("share-dialog", (await sheet.count()) > 0, "ShareDialog open");
    await page.screenshot({ path: `${OUT}/shots/share-dialog-1280.png`, fullPage: false });

    const sendInSheet = sheet.getByRole("button", { name: /^(Send|Resend)$/ }).first();
    if ((await sendInSheet.count()) > 0 && (await sendInSheet.isEnabled())) {
      await sendInSheet.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${OUT}/shots/after-send-1280.png`, fullPage: false });

      const { data: choicesAfter } = await admin
        .from("client_choices")
        .select("id, status")
        .eq("id", choicesBefore?.id ?? "")
        .maybeSingle();

      const statusOk =
        !choicesBefore
        || choicesAfter?.status === "sent"
        || choicesAfter?.status === "in_progress"
        || (choicesBefore.status === "sent" && choicesAfter?.status === "sent");
      record(
        "portal-status-sent",
        Boolean(statusOk),
        `before=${choicesBefore?.status} after=${choicesAfter?.status}`,
      );

      const { data: activities } = await admin
        .from("client_choices_activities")
        .select("type, title, description, created_at")
        .eq("client_choices_id", choicesBefore?.id ?? "")
        .order("created_at", { ascending: false })
        .limit(8);

      const types = (activities ?? []).map((a) => a.type);
      const hasEmailOutcome =
        types.includes("email_submitted") || types.includes("email_not_submitted");
      record(
        "email-activity",
        hasEmailOutcome,
        `types=${types.join(",")}`,
      );

      const emailSubmitted = types.includes("email_submitted");
      const emailFailed = types.includes("email_not_submitted");
      record(
        "email-outcome-truthful",
        emailSubmitted || emailFailed,
        emailSubmitted
          ? "provider accepted (submitted) — not claiming inbox delivery"
          : emailFailed
            ? "email_not_submitted recorded (portal may still be ready)"
            : "no email activity",
      );

      // Outbound conversation audit (best-effort)
      const { data: outbound } = await admin
        .from("conversation_messages")
        .select("id, status, channel_metadata, created_at")
        .eq("venue_id", FANCY)
        .order("created_at", { ascending: false })
        .limit(30);
      const related = (outbound ?? []).filter((m) => {
        const meta =
          typeof m.channel_metadata === "object" && m.channel_metadata
            ? (m.channel_metadata as Record<string, unknown>)
            : {};
        return meta.sourceType === "client_choices_request";
      });
      record(
        "outbound-or-activity",
        related.length > 0 || hasEmailOutcome,
        `outboundMatches=${related.length} activityOk=${hasEmailOutcome}`,
      );
    } else {
      record("portal-status-sent", false, "Send button disabled — likely no recipient email");
      record("email-activity", false, "could not click Send");
      record("email-outcome-truthful", false, "blocked");
      record("outbound-or-activity", false, "blocked");
      await page.screenshot({ path: `${OUT}/shots/share-dialog-disabled-1280.png`, fullPage: false });
    }
  }

  // Preview must not mutate
  const preview = page.locator('[data-testid="choices-staff-preview"]').first();
  if ((await preview.count()) > 0) {
    const { count: actBefore } = await admin
      .from("client_choices_activities")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY);
    await preview.click();
    await page.waitForTimeout(400);
    record(
      "preview-dialog",
      (await page.locator('[data-testid="choices-preview-dialog"]').count()) > 0,
      "preview open",
    );
    await page.keyboard.press("Escape");
    const { count: actAfter } = await admin
      .from("client_choices_activities")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY);
    record(
      "preview-no-activity-bump",
      (actAfter ?? 0) === (actBefore ?? 0),
      `before=${actBefore} after=${actAfter}`,
    );
  } else {
    record("preview-dialog", true, "N/A — no preview button");
    record("preview-no-activity-bump", true, "N/A");
  }

  await browser.close();

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
    eventStatusBefore: eventBefore?.status ?? null,
    eventStatusAfter: eventAfter?.status ?? null,
    clientId: eventBefore?.client_id ?? null,
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
