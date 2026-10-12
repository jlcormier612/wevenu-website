/**
 * Sandbox Luv drafting matrix:
 * 1) eligible → draft generated
 * 2) completed-tour silence → no false "outreach" CTA; silence copy
 * 3) actionable completed tour (unanswered inbound) → draft allowed
 * Disposable Fancy leads only. No send.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_PREFIX = process.env.EXPECTED_TIP_PREFIX ?? "";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/luv-draft-cta-fix";
const OUT = `${OUT_DIR}/eligibility-matrix-results.json`;
const SILENCE = "There's nothing that needs a follow-up right now.";
const OWNER_AVAILABLE =
  "No urgent follow-up right now. You can still ask Luv to draft a message when you want.";
const FALSE_OUTREACH = /recent outreach may still be open/i;
/** Proactive urging that contradicts silence empty-state (not the owner draft CTA label). */
const FOLLOW_UP_URGING =
  /may be worth following up|while the interest is fresh|showing strong interest/i;

function hasProactiveSilenceCopy(body: string): boolean {
  return body.includes(SILENCE) || body.includes(OWNER_AVAILABLE);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
const createdLeadIds: string[] = [];

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

async function cookiesFor(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
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

async function switchToFancy(page: import("playwright").Page) {
  await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Switch venue/i }).click();
  await page.getByRole("menuitem").filter({ hasText: /Fancy Venue/i }).first().click();
  await page.waitForTimeout(1500);
}

async function seedLead(opts: {
  first: string;
  completedTour?: boolean;
  unansweredInbound?: string;
  /** Genuine completed-tour follow-up already sent — silence. */
  followUpSent?: boolean;
  /** Seed an existing pending_review Luv draft. */
  existingDraft?: boolean;
  leadStatus?: "active" | "lost" | "booked";
}) {
  const email = `${opts.first.toLowerCase()}-${Date.now()}@hellotocheers-test.invalid`;
  const { data: relationshipId, error: relErr } = await admin.rpc("find_or_create_relationship", {
    p_venue_id: FANCY,
    p_email: email,
    p_first_name: opts.first,
    p_last_name: "Matrix",
  });
  if (relErr || !relationshipId) throw new Error(`relationship: ${relErr?.message}`);

  const { data: lead, error } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: opts.first,
      last_name: "Matrix",
      email,
      relationship_id: relationshipId,
      sales_stage: opts.completedTour ? "tour_scheduled" : "new_inquiry",
      status: opts.leadStatus ?? "active",
      source: "website",
      inquiry_message: "We would love to tour Saturday.",
      inquiry_message_origin: "customer",
      last_contacted_at: opts.completedTour ? null : hoursAgo(6),
      created_at: hoursAgo(72),
      ...(opts.leadStatus === "lost" ? { lost_at: hoursAgo(1) } : {}),
      ...(opts.leadStatus === "booked" ? { first_booked_at: hoursAgo(1) } : {}),
    })
    .select("id,relationship_id")
    .single();
  if (error || !lead) throw error ?? new Error("lead");
  createdLeadIds.push(lead.id);

  if (opts.completedTour) {
    const completedAt = hoursAgo(5);
    const { error: te } = await admin.from("tour_appointments").insert({
      venue_id: FANCY,
      lead_id: lead.id,
      scheduled_at: completedAt,
      actual_occurred_at: completedAt,
      completed_at: completedAt,
      duration_minutes: 60,
      contact_name: `${opts.first} Matrix`,
      status: "completed",
      origin: "scheduled",
      follow_up_sent_at: opts.followUpSent ? hoursAgo(3) : null,
    });
    if (te) throw te;
  }

  if (opts.existingDraft) {
    const { error: dErr } = await admin.from("luv_drafts").insert({
      venue_id: FANCY,
      entity_type: "lead",
      entity_id: lead.id,
      draft_type: "follow_up_email",
      subject: "Existing matrix draft",
      content: "Disposable existing draft body.",
      status: "pending_review",
      context: { seeded: true },
    });
    if (dErr) throw new Error(`draft seed: ${dErr.message}`);
  }

  if (opts.unansweredInbound) {
    let conversationId: string | null = null;
    const { data: existing } = await admin
      .from("conversations")
      .select("id")
      .eq("venue_id", FANCY)
      .eq("relationship_id", lead.relationship_id)
      .eq("conversation_kind", "venue_couple")
      .maybeSingle();
    if (existing?.id) {
      conversationId = existing.id;
      await admin
        .from("conversations")
        .update({
          inbox_owner_kind: "lead",
          inbox_owner_lead_id: lead.id,
        })
        .eq("id", existing.id);
    } else {
      const { data: conv, error: cErr } = await admin
        .from("conversations")
        .insert({
          venue_id: FANCY,
          relationship_id: lead.relationship_id,
          conversation_kind: "venue_couple",
          inbox_owner_kind: "lead",
          inbox_owner_lead_id: lead.id,
        })
        .select("id")
        .single();
      if (cErr || !conv) throw new Error(`conversation: ${cErr?.message}`);
      conversationId = conv.id;
    }
    const { error: mErr } = await admin.from("conversation_messages").insert({
      venue_id: FANCY,
      conversation_id: conversationId,
      sender_type: "lead_or_client",
      channel: "email",
      body: opts.unansweredInbound,
      sent_at: hoursAgo(2),
      status: "delivered",
    });
    if (mErr) throw new Error(`message: ${mErr.message}`);
  }

  return lead;
}

async function openLuv(page: import("playwright").Page, leadId: string) {
  await page.goto(`${APP}/leads/${leadId}?tab=luv`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByRole("tab", { name: /Luv/i }).click();
  await page.waitForTimeout(1200);
}

async function cleanup() {
  for (const id of createdLeadIds) {
    await admin.from("luv_drafts").delete().eq("entity_type", "lead").eq("entity_id", id);
    await admin.from("conversation_messages").delete().eq("lead_id", id);
    await admin.from("tour_appointments").delete().eq("lead_id", id);
    await admin.from("leads").delete().eq("id", id);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = Date.now().toString(36);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();

  try {
    await switchToFancy(page);
    const head = await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
    const sha =
      head?.headers()?.link?.match(/dpl=([0-9a-f]{40})/)?.[1]
      ?? (await page.content()).match(/dpl=([0-9a-f]{40})/)?.[1]
      ?? null;
    if (EXPECTED_PREFIX) {
      record("deployed_sha_prefix", !!sha && sha.startsWith(EXPECTED_PREFIX), `sha=${sha}`);
    } else {
      record("deployed_sha_captured", !!sha, `sha=${sha}`);
    }

    // 1) Eligible — no tour
    const eligible = await seedLead({ first: `Elig${stamp}` });
    await openLuv(page, eligible.id);
    const eligBody = await page.locator("body").innerText();
    const eligCta =
      (await page.getByTestId("luv-noticed-draft-follow-up").count()) > 0
      || (await page.getByRole("button", { name: /Draft a follow-up email/i }).count()) > 0;
    record("eligible_shows_draft_cta", eligCta && !eligBody.includes(SILENCE), `cta=${eligCta}`);
    if (eligCta) {
      const target =
        (await page.getByTestId("luv-noticed-draft-follow-up").count()) > 0
          ? page.locator('[role="tabpanel"]').getByTestId("luv-noticed-draft-follow-up").or(page.getByTestId("luv-noticed-draft-follow-up")).last()
          : page.getByRole("button", { name: /Draft a follow-up email/i });
      await target.click();
      for (let i = 0; i < 45; i++) {
        const { data } = await admin
          .from("luv_drafts")
          .select("id,status")
          .eq("entity_type", "lead")
          .eq("entity_id", eligible.id);
        if ((data ?? []).length > 0) break;
        await page.waitForTimeout(1000);
      }
      const { data: drafts } = await admin
        .from("luv_drafts")
        .select("id,status")
        .eq("entity_type", "lead")
        .eq("entity_id", eligible.id);
      record("eligible_draft_persisted", (drafts ?? []).length >= 1, `n=${drafts?.length}`);
    }
    await page.screenshot({ path: `${OUT_DIR}/matrix-eligible.png`, fullPage: true });

    // 2) Completed-tour silence — proactive quiet; owner draft CTA remains
    const silence = await seedLead({ first: `Sil${stamp}`, completedTour: true });
    await openLuv(page, silence.id);
    const silBody = await page.locator("body").innerText();
    const silCta = await page.getByRole("button", { name: /Draft a follow-up email/i }).count();
    const falseOutreach = FALSE_OUTREACH.test(silBody);
    const noticedLabels = await page.getByText("Luv noticed", { exact: false }).count();
    record(
      "silence_no_false_outreach_copy",
      !falseOutreach && hasProactiveSilenceCopy(silBody),
      `falseOutreach=${falseOutreach} silenceCopy=${hasProactiveSilenceCopy(silBody)}`,
    );
    record(
      "silence_keeps_owner_draft_cta",
      silCta > 0,
      `ctaCount=${silCta} noticedLabels=${noticedLabels}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/matrix-silence.png`, fullPage: true });

    // 3) Completed tour + unanswered question → eligible
    const actionable = await seedLead({
      first: `Ask${stamp}`,
      completedTour: true,
      unansweredInbound: "What is the pricing for the Saturday package?",
    });
    await openLuv(page, actionable.id);
    const askBody = await page.locator("body").innerText();
    const askCta = await page.getByRole("button", { name: /Draft a follow-up email|Draft a reply/i }).count();
    record(
      "actionable_completed_tour_allows_draft",
      askCta > 0 && !askBody.includes(SILENCE),
      `cta=${askCta}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/matrix-actionable.png`, fullPage: true });

    // Ellie real lead forensic (no mutation) — Oct 12 contradiction must be gone
    await openLuv(page, "e26c3be4-d805-4c01-a215-9709cb814f60");
    const ellieBody = await page.locator("body").innerText();
    const ellieSilence = hasProactiveSilenceCopy(ellieBody);
    const ellieUrging = FOLLOW_UP_URGING.test(ellieBody);
    const ellieDraftCta = await page.getByRole("button", { name: /Draft a follow-up email/i }).count();
    const ellieNoticedCount = await page.getByText("Luv noticed", { exact: false }).count();
    const ellieContradiction = ellieUrging && ellieSilence;
    record(
      "ellie_no_false_outreach_copy",
      !FALSE_OUTREACH.test(ellieBody),
      FALSE_OUTREACH.test(ellieBody) ? "still shows outreach fiction" : "clean",
    );
    record(
      "ellie_noticed_luv_tab_consistent",
      !ellieContradiction && ellieDraftCta > 0 && ellieNoticedCount <= 1,
      `silenceCopy=${ellieSilence} cta=${ellieDraftCta} urging=${ellieUrging} noticed=${ellieNoticedCount}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/matrix-ellie.png`, fullPage: true });

    // Seeded silence must not urge follow-up in Noticed; owner CTA may remain
    const silenceUrging = FOLLOW_UP_URGING.test(silBody);
    record(
      "silence_noticed_no_follow_up_urging",
      !silenceUrging && silCta > 0,
      `urging=${silenceUrging} cta=${silCta}`,
    );

    // 4) Follow-up already sent → proactive quiet; owner may still draft; no false outreach fiction
    const sent = await seedLead({
      first: `Sent${stamp}`,
      completedTour: true,
      followUpSent: true,
      unansweredInbound: "What is the pricing?",
    });
    await openLuv(page, sent.id);
    const sentBody = await page.locator("body").innerText();
    const sentCta = await page.getByRole("button", { name: /Draft a follow-up email/i }).count();
    record(
      "follow_up_sent_owner_draft_without_false_outreach",
      sentCta > 0 && !FALSE_OUTREACH.test(sentBody) && !FOLLOW_UP_URGING.test(sentBody),
      `cta=${sentCta} falseOutreach=${FALSE_OUTREACH.test(sentBody)} silenceCopy=${hasProactiveSilenceCopy(sentBody)}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/matrix-follow-up-sent.png`, fullPage: true });

    // 5) Existing pending draft — CTA still available; draft row visible; no auto-send
    const withDraft = await seedLead({ first: `Draft${stamp}`, existingDraft: true });
    await openLuv(page, withDraft.id);
    const draftBody = await page.locator("body").innerText();
    const draftCta =
      (await page.getByTestId("luv-noticed-draft-follow-up").count()) > 0
      || (await page.getByRole("button", { name: /Draft a follow-up email/i }).count()) > 0;
    const seesExisting = /Existing matrix draft|pending review|Pending review/i.test(draftBody);
    record(
      "existing_draft_visible_and_cta_safe",
      seesExisting && !FALSE_OUTREACH.test(draftBody),
      `cta=${draftCta} seesExisting=${seesExisting}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/matrix-existing-draft.png`, fullPage: true });

    // 6) Lost lead — drafting not advertised with outreach fiction
    const lost = await seedLead({ first: `Lost${stamp}`, leadStatus: "lost" });
    await openLuv(page, lost.id);
    const lostBody = await page.locator("body").innerText();
    record(
      "lost_lead_no_false_outreach_copy",
      !FALSE_OUTREACH.test(lostBody),
      `falseOutreach=${FALSE_OUTREACH.test(lostBody)}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/matrix-lost.png`, fullPage: true });

    // 7) Concurrent generate clicks on eligible lead — at least one draft, no crash
    const concurrent = await seedLead({ first: `Conc${stamp}` });
    await openLuv(page, concurrent.id);
    const concCta = page.getByRole("button", { name: /Draft a follow-up email/i }).first();
    if ((await concCta.count()) > 0) {
      await Promise.all([concCta.click(), concCta.click().catch(() => undefined)]);
      for (let i = 0; i < 45; i++) {
        const { data } = await admin
          .from("luv_drafts")
          .select("id")
          .eq("entity_type", "lead")
          .eq("entity_id", concurrent.id);
        if ((data ?? []).length > 0) break;
        await page.waitForTimeout(1000);
      }
      const { data: concDrafts } = await admin
        .from("luv_drafts")
        .select("id,status")
        .eq("entity_type", "lead")
        .eq("entity_id", concurrent.id);
      record(
        "concurrent_clicks_persist_draft",
        (concDrafts ?? []).length >= 1,
        `n=${concDrafts?.length}`,
      );
    } else {
      record("concurrent_clicks_persist_draft", false, "no CTA");
    }
    await page.screenshot({ path: `${OUT_DIR}/matrix-concurrent.png`, fullPage: true });
  } finally {
    await browser.close();
    await cleanup();
  }

  const pass = checks.every((c) => c.pass);
  const result = { at: new Date().toISOString(), pass, checks };
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
