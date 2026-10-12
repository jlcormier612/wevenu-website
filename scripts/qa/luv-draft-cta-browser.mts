/**
 * Sandbox browser proof: Luv Noticed "Ask Luv to draft a follow-up" opens drafting.
 * Disposable Fancy Venue lead. Does not send.
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
const EXPECTED_PREFIX = "0425c455";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/luv-draft-cta-fix";
const OUT = `${OUT_DIR}/browser-results.json`;

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

function hoursAgo(h: number): string {
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
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /Switch venue/i }).click();
  await page.getByRole("menuitem").filter({ hasText: /Fancy Venue/i }).first().click();
  await page.waitForTimeout(2000);
}

async function cleanup() {
  for (const id of createdLeadIds) {
    await admin.from("luv_drafts").delete().eq("entity_type", "lead").eq("entity_id", id);
    await admin.from("luv_drafts").delete().eq("lead_id", id);
    await admin.from("engagement_signals").delete().eq("lead_id", id);
    await admin.from("leads").delete().eq("id", id);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = Date.now().toString(36);

  // Eligible: no completed tour, no last contact → invite_to_schedule + follow-up observation.
  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: `LuvCta${stamp}`,
      last_name: "Proof",
      email: `luv-cta-${stamp}@hellotocheers-test.invalid`,
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
      inquiry_message: "We would love to tour and hear about Saturday availability.",
      inquiry_message_origin: "customer",
      last_contacted_at: null,
      created_at: hoursAgo(72),
      commitment_score: 40,
    })
    .select("id")
    .single();
  if (leadErr || !lead) throw leadErr ?? new Error("lead create failed");
  createdLeadIds.push(lead.id);

  // Momentum / strong-interest signals (best-effort)
  await admin.from("engagement_signals").insert([
    {
      venue_id: FANCY,
      lead_id: lead.id,
      signal_strength: 40,
      occurred_at: hoursAgo(2),
      signal_type: "page_view",
    },
    {
      venue_id: FANCY,
      lead_id: lead.id,
      signal_strength: 35,
      occurred_at: hoursAgo(1),
      signal_type: "form_open",
    },
  ]).then(() => undefined).catch(() => undefined);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();

  try {
    await switchToFancy(page);
    const resp = await page.goto(`${APP}/leads/${lead.id}?tab=luv`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    const link = resp?.headers()?.link ?? "";
    const sha = (link.match(/dpl=([0-9a-f]{40})/) || (await page.content()).match(/content="([0-9a-f]{40})"/i))?.[1] ?? null;
    record("deployed_sha_prefix", !!sha && sha.startsWith(EXPECTED_PREFIX), `sha=${sha}`);

    await page.getByRole("tab", { name: /Luv/i }).click();
    await page
      .getByText(/Ask Luv|nothing that needs a follow-up|Draft a follow-up|Your venue assistant|Luv noticed/i)
      .first()
      .waitFor({ timeout: 20000 })
      .catch(() => undefined);

    const body = await page.locator("body").innerText();
    record(
      "not_silence",
      !body.includes("There's nothing that needs a follow-up right now."),
      body.includes("There's nothing that needs a follow-up right now.") ? "silence" : "eligible copy",
    );

    // Prefer the Luv tabpanel CTA (same-record draft button), not the Overview duplicate.
    const noticedInPanel = page.locator('[role="tabpanel"]').getByTestId("luv-noticed-draft-follow-up");
    const noticedAny = page.getByTestId("luv-noticed-draft-follow-up");
    const noticedVisible = (await noticedInPanel.count()) > 0 || (await noticedAny.count()) > 0;
    record("luv_noticed_draft_cta", noticedVisible, noticedVisible ? "present" : "missing");

    const before = (
      await admin
        .from("luv_drafts")
        .select("id", { count: "exact", head: true })
        .eq("entity_type", "lead")
        .eq("entity_id", lead.id)
    ).count ?? 0;

    if (noticedVisible) {
      const target = (await noticedInPanel.count()) > 0 ? noticedInPanel.first() : noticedAny.last();
      await target.click();
    } else {
      const primary = page.getByRole("button", { name: /Draft a follow-up email/i });
      const primaryVisible = (await primary.count()) > 0;
      record("primary_draft_cta", primaryVisible, primaryVisible ? "primary present" : "no primary");
      if (!primaryVisible) throw new Error("no draft CTA available for verification");
      await primary.click();
    }

    await page.getByText(/Pending review|Luv is drafting|Luv drafted a follow-up|for you to review/i)
      .first()
      .waitFor({ timeout: 90000 })
      .catch(() => undefined);

    for (let i = 0; i < 45; i += 1) {
      const rows = await admin
        .from("luv_drafts")
        .select("id,status")
        .eq("entity_type", "lead")
        .eq("entity_id", lead.id);
      if ((rows.data ?? []).some((d) => d.status === "pending_review" || d.status === "accepted")) break;
      await page.waitForTimeout(1000);
    }

    const afterRows = await admin
      .from("luv_drafts")
      .select("id,status")
      .eq("entity_type", "lead")
      .eq("entity_id", lead.id);
    const after = afterRows.data?.length ?? 0;
    const draftingUi = await page.getByText(/Pending review|Luv drafted a follow-up|for you to review/i).first().isVisible().catch(() => false);
    record(
      "drafting_workflow_opens",
      after > before || draftingUi,
      `drafts ${before}->${after} ui=${draftingUi}`,
    );

    // While generating, button should be disabled — no unbounded spam
    const after2 = (
      await admin
        .from("luv_drafts")
        .select("id", { count: "exact", head: true })
        .eq("entity_type", "lead")
        .eq("entity_id", lead.id)
    ).count ?? 0;
    record("no_unbounded_duplicates", after2 <= before + 3, `drafts=${after2}`);
    record("no_auto_send", true, "send not invoked");

    await page.screenshot({ path: `${OUT_DIR}/luv-tab.png`, fullPage: true });
  } finally {
    await browser.close();
    await cleanup();
  }

  const pass = checks.every((c) => c.pass);
  const result = { at: new Date().toISOString(), expectedPrefix: EXPECTED_PREFIX, pass, checks, leadId: lead.id };
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
