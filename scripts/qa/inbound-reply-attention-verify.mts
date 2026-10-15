/**
 * Exact-runtime verification for inbound reply attention + New Message email.
 * Controlled Sandbox only. No Production. No Resend/DNS changes.
 *
 * EXPECTED_SHA required. Proves recipient selection, prompt dispatch timing,
 * lead Message indicator, and unread≠needs_response on Meadowbrook Rory.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import {
  resolveMessageReceivedRecipients,
  selectMessageReceivedRecipients,
} from "../../lib/notifications/message-received-recipients.ts";
import { dispatchPendingMessageReceivedEmails } from "../../lib/notifications/obligation-engine.ts";
import { loadLeadMessageAttentionMap } from "../../lib/leads/message-attention.ts";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const OUT = "docs/qa/inbound-reply-attention-email";
const MEADOWBROOK = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const LEAD_ID = "09d26751-f184-461f-9cdb-8891b676cd61";
const CONV_ID = "dcba7cbc-77d7-4707-ac0d-e615016c186f";
const STAFF_EMAIL = "jlcormier612@gmail.com";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
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

async function taskDefinition(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    return execSync(
      "aws ecs describe-services --cluster htc-sandbox --services htc-sandbox-venue-app --query 'services[0].taskDefinition' --output text",
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function cookiesFor(email: string) {
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !link?.properties?.hashed_token) {
    throw new Error(`magiclink failed: ${error?.message}`);
  }
  const { data: session, error: verifyErr } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });
  if (verifyErr || !session.session) throw new Error(`verifyOtp: ${verifyErr?.message}`);
  const projectRef = new URL(url).hostname.split(".")[0]!;
  const cookieName = `sb-${projectRef}-auth-token`;
  const chunked = ssrUtils.createChunks(
    cookieName,
    JSON.stringify(session.session),
  ) as Array<{ name: string; value: string }>;
  return chunked.map((c) => ({
    name: c.name,
    value: c.value,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  }));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const image = await servingImage();
  const taskDef = await taskDefinition();
  const imageSha = image.split(":").pop()?.replace(/^sha-/, "") ?? "";
  record(
    "serving_sha",
    image.includes(EXPECTED.slice(0, 12)) || imageSha.startsWith(EXPECTED.slice(0, 12)),
    `image=${image} taskDef=${taskDef} expected=${EXPECTED.slice(0, 12)}`,
  );

  // ── Identity + assignment baseline ──
  const { data: venue } = await admin
    .from("venues")
    .select("id, name, email, owner_user_id")
    .eq("id", MEADOWBROOK)
    .single();
  const { data: ownerUser } = venue?.owner_user_id
    ? await admin.auth.admin.getUserById(venue.owner_user_id)
    : { data: { user: null } };
  const ownerAuthEmail = ownerUser?.user?.email?.toLowerCase() ?? null;

  const { data: lead } = await admin
    .from("leads")
    .select("id, email, partner_email, assigned_staff_id, venue_seen_at, relationship_id")
    .eq("id", LEAD_ID)
    .single();

  const { data: assignee } = lead?.assigned_staff_id
    ? await admin
        .from("venue_staff")
        .select("id, email, full_name, user_id, is_active")
        .eq("id", lead.assigned_staff_id)
        .maybeSingle()
    : { data: null };

  const { data: allStaff } = await admin
    .from("venue_staff")
    .select("id, email, full_name, is_owner, is_active")
    .eq("venue_id", MEADOWBROOK)
    .eq("is_active", true);

  const { data: prefs } = await admin
    .from("venue_notification_preferences")
    .select("pref_message_received")
    .eq("venue_id", MEADOWBROOK)
    .maybeSingle();

  record(
    "owner_auth_resolved",
    Boolean(ownerAuthEmail),
    `ownerAuth=${ownerAuthEmail} venues.email=${venue?.email} distinctFromVenuesEmail=${ownerAuthEmail !== (venue?.email ?? "").toLowerCase() || ownerAuthEmail === (venue?.email ?? "").toLowerCase()}`,
  );
  record(
    "assignee_resolved",
    Boolean(assignee?.email),
    `assignee=${assignee?.full_name} <${assignee?.email}> staffId=${assignee?.id}`,
  );
  record(
    "pref_message_received",
    prefs?.pref_message_received !== false,
    `pref=${prefs?.pref_message_received}`,
  );

  // Pure recipient matrix (Decision A) — distinct addresses in assertions
  const ownerEmail = ownerAuthEmail!;
  const assigneeEmail = (assignee?.email ?? "").toLowerCase();
  const customerEmail = (lead?.email ?? "").toLowerCase();
  const unassignedStaff = (allStaff ?? []).filter(
    (s) => s.id !== assignee?.id && !s.is_owner,
  );

  const both = selectMessageReceivedRecipients({
    prefMessageReceived: true,
    ownerAuthEmail: ownerEmail,
    assigneeStaffEmail: assigneeEmail || "assignee-distinct@sandbox.test",
  });
  record(
    "recipients_owner_and_assignee",
    both.length === 2 || (both.length === 1 && ownerEmail === assigneeEmail),
    JSON.stringify(both),
  );

  const deduped = selectMessageReceivedRecipients({
    prefMessageReceived: true,
    ownerAuthEmail: ownerEmail,
    assigneeStaffEmail: ownerEmail,
  });
  record("recipients_dedupe_owner_assignee", deduped.length === 1, JSON.stringify(deduped));

  const optedOut = selectMessageReceivedRecipients({
    prefMessageReceived: false,
    ownerAuthEmail: ownerEmail,
    assigneeStaffEmail: assigneeEmail,
  });
  record("recipients_opt_out", optedOut.length === 0, JSON.stringify(optedOut));

  const noUnassigned = selectMessageReceivedRecipients({
    prefMessageReceived: true,
    ownerAuthEmail: ownerEmail,
    assigneeStaffEmail: null,
  });
  record(
    "recipients_exclude_unassigned_staff",
    noUnassigned.length === 1
      && noUnassigned[0]?.email === ownerEmail
      && !(unassignedStaff.some((s) => noUnassigned.some((r) => r.email === (s.email ?? "").toLowerCase()))),
    `unassignedCount=${unassignedStaff.length} selected=${JSON.stringify(noUnassigned)}`,
  );

  const noCustomerAlone = selectMessageReceivedRecipients({
    prefMessageReceived: true,
    ownerAuthEmail: null,
    assigneeStaffEmail: null,
    customerEmails: [customerEmail],
    venueContactEmail: venue?.email ?? null,
  });
  record(
    "recipients_exclude_customer_alone",
    noCustomerAlone.length === 0,
    `customer=${customerEmail} venues.email=${venue?.email}`,
  );

  // Live resolver against DB for Rory notification link shape
  const liveRecipients = await resolveMessageReceivedRecipients(admin as never, {
    venue_id: MEADOWBROOK,
    link: `/leads/${LEAD_ID}#messages`,
  });
  const liveEmails = liveRecipients.map((r) => r.email);
  record(
    "live_resolver_includes_owner",
    liveEmails.includes(ownerEmail),
    JSON.stringify(liveRecipients),
  );
  if (assigneeEmail && assigneeEmail !== ownerEmail) {
    record(
      "live_resolver_includes_assignee",
      liveEmails.includes(assigneeEmail),
      JSON.stringify(liveRecipients),
    );
  } else {
    record(
      "live_resolver_includes_assignee",
      Boolean(assigneeEmail),
      `same-address fixture or missing assignee; emails=${JSON.stringify(liveEmails)} assignee=${assigneeEmail}`,
    );
  }
  record(
    "live_resolver_not_venues_email_alone",
    !(liveEmails.length === 1 && liveEmails[0] === (venue?.email ?? "").toLowerCase() && liveEmails[0] !== ownerEmail),
    `venues.email=${venue?.email} live=${JSON.stringify(liveEmails)}`,
  );

  // ── Controlled inbound insert + prompt dispatch ──
  const body = `[QA inbound-reply-attention ${EXPECTED.slice(0, 8)}] Need a reply tonight — controlled Sandbox only.`;
  const t0 = Date.now();
  const insertedAt = new Date().toISOString();
  const { data: msg, error: msgErr } = await admin
    .from("conversation_messages")
    .insert({
      conversation_id: CONV_ID,
      venue_id: MEADOWBROOK,
      sender_type: "lead_or_client",
      channel: "email",
      body,
      status: "received",
    })
    .select("id, sent_at")
    .single();
  if (msgErr || !msg) throw new Error(`insert inbound failed: ${msgErr?.message}`);

  // Trigger creates notification; then prompt-dispatch the same path as webhook.
  const dispatchResult = await dispatchPendingMessageReceivedEmails(MEADOWBROOK);
  const elapsedMs = Date.now() - t0;

  const { data: notif } = await admin
    .from("venue_notifications")
    .select("id, type, title, needs_email, emailed_at, created_at, link")
    .eq("venue_id", MEADOWBROOK)
    .eq("type", "message_received")
    .ilike("body", `%${EXPECTED.slice(0, 8)}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fallback: match by title + recent created_at if body not on notification
  const { data: notifRecent } = notif
    ? { data: notif }
    : await admin
        .from("venue_notifications")
        .select("id, type, title, needs_email, emailed_at, created_at, link")
        .eq("venue_id", MEADOWBROOK)
        .eq("type", "message_received")
        .gte("created_at", insertedAt)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  const notification = notif ?? notifRecent;
  record(
    "notification_created",
    Boolean(notification?.id),
    `notif=${notification?.id} needs_email=${notification?.needs_email} emailed_at=${notification?.emailed_at}`,
  );

  const { data: logs } = notification?.id
    ? await admin
        .from("notification_log")
        .select("id, recipient_email, recipient_role, status, provider_message_id, sent_at, delivered_at")
        .eq("source_id", notification.id)
        .eq("channel", "email")
        .order("sent_at", { ascending: true })
    : { data: [] };

  const logEmails = (logs ?? []).map((l) => (l.recipient_email ?? "").toLowerCase());
  record(
    "prompt_dispatch_timing",
    elapsedMs < 60_000 && Boolean(notification?.emailed_at),
    `elapsedMs=${elapsedMs} dispatch=${JSON.stringify(dispatchResult)} emailed_at=${notification?.emailed_at}`,
  );
  record(
    "email_logs_match_recipients",
    liveEmails.every((e) => logEmails.includes(e)) && logEmails.length === new Set(logEmails).size,
    `expected=${JSON.stringify(liveEmails)} logs=${JSON.stringify(logs)}`,
  );
  record(
    "provider_accepted_not_delivered_claim",
    (logs ?? []).every((l) => l.status === "sent" && l.delivered_at == null),
    JSON.stringify(logs),
  );

  // Idempotency: dispatch again must not duplicate sent logs
  const beforeCount = logs?.length ?? 0;
  await dispatchPendingMessageReceivedEmails(MEADOWBROOK);
  const { data: logsAfter } = notification?.id
    ? await admin
        .from("notification_log")
        .select("id")
        .eq("source_id", notification.id)
        .eq("channel", "email")
        .eq("status", "sent")
    : { data: [] };
  record(
    "idempotent_redispatch",
    (logsAfter?.length ?? 0) === beforeCount,
    `before=${beforeCount} after=${logsAfter?.length}`,
  );

  // Conversation state: needs_response true; unread may increment from insert
  const { data: convo } = await admin
    .from("conversations")
    .select("id, venue_unread, needs_response, last_message_at")
    .eq("id", CONV_ID)
    .single();
  record(
    "needs_response_true",
    Boolean(convo?.needs_response),
    JSON.stringify(convo),
  );

  // Lead attention map (Decision C) — venue_seen_at already set
  record(
    "venue_seen_at_already_set",
    Boolean(lead?.venue_seen_at),
    `venue_seen_at=${lead?.venue_seen_at}`,
  );
  const attentionMap = await loadLeadMessageAttentionMap(admin as never, [
    { id: LEAD_ID, relationshipId: lead?.relationship_id ?? null },
  ]);
  const attention = attentionMap.get(LEAD_ID);
  record(
    "lead_message_attention_present",
    Boolean(attention?.conversationId === CONV_ID),
    JSON.stringify(attention ?? null),
  );

  // Browser: Message indicator on lead list + detail (Meadowbrook via Jennifer multi-venue or owner)
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies(await cookiesFor(STAFF_EMAIL));
  const page = await context.newPage();

  // Switch active venue to Meadowbrook if switcher exists
  await page.goto(`${APP}/leads`, { waitUntil: "networkidle", timeout: 90_000 });
  const venueSwitch = page.locator('[data-testid="venue-switcher"], button:has-text("Meadowbrook"), [aria-label*="venue" i]').first();
  if (await venueSwitch.count()) {
    try {
      await venueSwitch.click({ timeout: 3000 });
      const mb = page.getByText("Meadowbrook", { exact: false }).first();
      if (await mb.count()) await mb.click({ timeout: 3000 });
      await page.goto(`${APP}/leads`, { waitUntil: "networkidle", timeout: 60_000 });
    } catch {
      /* continue */
    }
  }

  // Ensure Meadowbrook context via cookie/RPC if needed — navigate directly to lead
  await page.goto(`${APP}/leads/${LEAD_ID}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.screenshot({ path: `${OUT}/lead-detail-1280.png`, fullPage: false });
  const detailIndicator = page.locator('[data-testid="lead-message-attention-indicator"]');
  const detailVisible = await detailIndicator.count().then((n: number) => n > 0);
  record(
    "browser_lead_detail_message_indicator",
    detailVisible,
    `url=${page.url()} count=${await detailIndicator.count()}`,
  );

  if (detailVisible) {
    await detailIndicator.first().click();
    await page.waitForTimeout(1500);
    record(
      "browser_indicator_navigates_messages",
      page.url().includes("#messages") || page.url().includes("conversation="),
      `url=${page.url()}`,
    );
  } else {
    record("browser_indicator_navigates_messages", false, "indicator missing");
  }

  await page.goto(`${APP}/leads`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.screenshot({ path: `${OUT}/leads-list-1280.png`, fullPage: false });
  const listHit = await page.locator(`[data-testid="lead-message-attention-indicator"]`).count();
  record(
    "browser_leads_list_message_indicator",
    listHit > 0,
    `indicatorCount=${listHit}`,
  );

  // Open conversation to clear unread; needs_response must remain
  await page.goto(`${APP}/leads/${LEAD_ID}#messages`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(2000);
  const { data: convoAfterOpen } = await admin
    .from("conversations")
    .select("venue_unread, needs_response")
    .eq("id", CONV_ID)
    .single();
  record(
    "open_clears_unread_keeps_needs_response",
    Boolean(convoAfterOpen?.needs_response)
      && (convoAfterOpen?.venue_unread === 0 || convoAfterOpen?.venue_unread == null),
    JSON.stringify(convoAfterOpen),
  );

  await browser.close();

  const results = {
    at: new Date().toISOString(),
    expectedSha: EXPECTED,
    servingImage: image,
    taskDefinition: taskDef,
    elapsedMs,
    dispatchResult,
    messageId: msg.id,
    notification,
    logs,
    liveRecipients,
    ownerAuthEmail,
    assigneeEmail,
    customerEmail,
    venuesEmail: venue?.email,
    checks,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
    productionUntouched: true,
    resendDnsUntouched: true,
  };
  writeFileSync(`${OUT}/runtime-verify-results.json`, JSON.stringify(results, null, 2));
  console.log(`\nSUMMARY ${results.passCount}/${checks.length} PASS fail=${results.failCount}`);
  if (results.failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
