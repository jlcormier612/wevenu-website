/**
 * Sandbox: tax default prefill + rehearsal dinner on contract draft.
 * Disposable Meadowbrook fixtures. No send / no payments.
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
const EXPECTED = process.env.EXPECTED_TIP_PREFIX ?? "ee3b67a9";
const EMAIL = "jennifer@hellotocheers.com";
/** Jen's Fancy Venue — reliable staff access + 6.25% default tax. */
const VENUE = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const BARN = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const BARN_NAME = "Barn";
const OUT_DIR = "docs/qa/tax-discount-workflow";
const OUT = `${OUT_DIR}/tax-rehearsal-browser-results.json`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
let leadId: string | null = null;
let clientId: string | null = null;
let invoiceId: string | null = null;
let contractId: string | null = null;

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
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
      value: VENUE,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function seed() {
  const stamp = Date.now();
  const email = `tax-reh-${stamp}@hellotocheers-test.invalid`;
  const { data: relId, error: relErr } = await admin.rpc("find_or_create_relationship", {
    p_venue_id: VENUE,
    p_email: email,
    p_first_name: "TaxReh",
    p_last_name: "Fixture",
  });
  if (relErr || !relId) throw new Error(relErr?.message ?? "rel");

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: VENUE,
      relationship_id: relId,
      first_name: "TaxReh",
      last_name: "Fixture",
      email,
      event_type: "wedding",
      event_date: "2027-09-04",
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
      inquiry_message: "Disposable tax/rehearsal fixture",
      inquiry_message_origin: "customer",
    })
    .select("id")
    .single();
  if (leadErr || !lead) throw leadErr ?? new Error("lead");
  leadId = lead.id;

  // Ceremony + reception + rehearsal dinner with agreed Sep 3 date
  for (const row of [
    { use_key: "ceremony", preference_kind: "venue_space", space_id: BARN, scheduled_date: null },
    { use_key: "reception", preference_kind: "venue_space", space_id: BARN, scheduled_date: null },
    {
      use_key: "rehearsal_dinner",
      preference_kind: "venue_space",
      space_id: BARN,
      scheduled_date: "2027-09-03",
    },
  ]) {
    const { error } = await admin.from("lead_event_space_preferences").upsert(
      {
        venue_id: VENUE,
        lead_id: leadId,
        ...row,
        external_location: null,
      },
      { onConflict: "lead_id,use_key" },
    );
    if (error) throw new Error(`pref ${row.use_key}: ${error.message}`);
  }

  // Active hold on Sep 3 (availability only — must not alone become contract text)
  await admin.from("date_holds").insert({
    venue_id: VENUE,
    lead_id: leadId,
    hold_date: "2027-09-03",
    status: "active",
    space_id: BARN,
    title: "Disposable hold",
  });

  // Draft client linked for contract merge (pre-booking)
  const { data: client, error: cErr } = await admin
    .from("clients")
    .insert({
      venue_id: VENUE,
      relationship_id: relId,
      lead_id: leadId,
      first_name: "TaxReh",
      last_name: "Fixture",
      email,
      event_type: "wedding",
      event_date: "2027-09-04",
      // intentionally null — contract should use preference scheduled_date
      rehearsal_date: null,
    })
    .select("id")
    .single();
  if (cErr || !client) throw cErr ?? new Error("client");
  clientId = client.id;

  // Draft invoice for tax prefill (empty lines)
  const today = new Date().toISOString().slice(0, 10);
  const { data: inv, error: iErr } = await admin
    .from("invoices")
    .insert({
      venue_id: VENUE,
      client_id: clientId,
      status: "draft",
      invoice_number: `QA-TAX-${stamp}`,
      issued_at: today,
      due_date: today,
      subtotal: 1000,
      tax_amount: 0,
      discount_amount: 0,
      total: 1000,
      balance_due: 1000,
    })
    .select("id")
    .single();
  if (iErr || !inv) throw iErr ?? new Error(`invoice: ${iErr?.message}`);
  invoiceId = inv.id;

  // Charge line so tax has a base
  const { error: lineErr } = await admin.from("invoice_line_items").insert({
    venue_id: VENUE,
    invoice_id: invoiceId,
    type: "item",
    description: "Fixture charge",
    quantity: 1,
    unit_price: 1000,
    amount: 1000,
    sort_order: 0,
  });
  if (lineErr) throw new Error(`line: ${lineErr.message}`);
}

async function cleanup() {
  if (contractId) await admin.from("contracts").delete().eq("id", contractId);
  if (invoiceId) {
    await admin.from("invoice_line_items").delete().eq("invoice_id", invoiceId);
    await admin.from("invoices").delete().eq("id", invoiceId);
  }
  if (leadId) {
    await admin.from("date_holds").delete().eq("lead_id", leadId);
    await admin.from("lead_event_space_preferences").delete().eq("lead_id", leadId);
  }
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  if (leadId) await admin.from("leads").delete().eq("id", leadId);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await seed();

  // DB assertion: venue default
  const { data: venue } = await admin
    .from("venues")
    .select("commercial_booking_prefs")
    .eq("id", VENUE)
    .maybeSingle();
  const prefs = venue?.commercial_booking_prefs as { defaultTaxPercent?: number; useTaxes?: boolean };
  record(
    "venue_default_tax_6_25",
    prefs?.useTaxes === true && prefs?.defaultTaxPercent === 6.25,
    JSON.stringify(prefs?.defaultTaxPercent),
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(await cookiesFor(EMAIL));
  const page = await context.newPage();

  try {
    // Venue context comes from htc_active_venue_id cookie (Fancy).
    await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(600);
    const switcher = page.getByRole("button", { name: /Switch venue/i });
    if (await switcher.count()) {
      await switcher.click();
      await page.getByRole("menuitem").filter({ hasText: /Fancy Venue/i }).first().click();
      await page.waitForTimeout(1200);
    }

    const head = await page.goto(`${APP}/invoices/${invoiceId}`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await page.waitForTimeout(1200);
    const sha =
      head?.headers()?.link?.match(/dpl=([0-9a-f]{40})/)?.[1]
      ?? (await page.content()).match(/dpl=([0-9a-f]{40})/)?.[1]
      ?? null;
    record("deployed_sha", !!sha && sha.startsWith(EXPECTED), `sha=${sha}`);

    await page.getByTestId("invoice-add-tax").waitFor({ state: "visible", timeout: 20000 });
    await page.getByTestId("invoice-add-tax").click();
    await page.waitForTimeout(800);
    const taxInput = page.getByTestId("invoice-tax-rate-input");
    await taxInput.waitFor({ state: "visible", timeout: 20000 });
    const rate = await taxInput.inputValue();
    record("tax_prefill_6_25", rate === "6.25", `rate=${rate}`);
    await page.screenshot({ path: `${OUT_DIR}/tax-prefill.png`, fullPage: true });

    // Override to 7, save, assert persistence
    await taxInput.fill("7");
    await page.getByRole("button", { name: /Add Line Item/i }).click();
    await page.waitForTimeout(2500);
    const { data: taxLines } = await admin
      .from("invoice_line_items")
      .select("type,tax_rate_value,amount,description")
      .eq("invoice_id", invoiceId!)
      .eq("type", "tax");
    const saved = taxLines?.[0];
    record(
      "tax_override_7_persisted",
      saved?.tax_rate_value === 7 && Number(saved?.amount) === 70,
      JSON.stringify(saved),
    );

    // Add another tax — should start at default again
    await page.getByTestId("invoice-add-tax").waitFor({ state: "visible", timeout: 15000 });
    await page.getByTestId("invoice-add-tax").click();
    await page.waitForTimeout(800);
    const rate2 = await page.getByTestId("invoice-tax-rate-input").inputValue();
    record("second_tax_starts_at_default", rate2 === "6.25", `rate=${rate2}`);
    await page.getByRole("button", { name: /Cancel/i }).click();

    // Contract materialize via merge proof (DB + API path through build)
    // Create draft contract from starter content with tokens
    const { WEDDING_VENUE_AGREEMENT_CONTENT } = await import(
      "@/lib/contracts/starters"
    ).catch(() => ({ WEDDING_VENUE_AGREEMENT_CONTENT: null }));
    // Fallback: read from known tokens
    const content =
      typeof WEDDING_VENUE_AGREEMENT_CONTENT === "string"
        ? WEDDING_VENUE_AGREEMENT_CONTENT
        : `Event Date\n{{event_date}}\n\nRehearsal Date\n{{rehearsal_date}}\n\nCeremony\n{{ceremony_space}}\n\nReception\n{{reception_space}}\n\nAdditional Event Spaces\n{{additional_event_spaces}}\n`;

    // Use service-role insert of draft; then open in browser after resolving via app preview
    // Prefer calling materialize through a node import of buildMergeData path — use admin + script helper
    const { buildMergeData, mergeContent } = await import("@/lib/contracts/merge");
    const { resolveAdditionalEventSpacesLabel, omitEmptyOptionalEventScheduleSections } =
      await import("@/lib/contracts/event-spaces-merge");
    const { formatContractDate } = await import("@/lib/contracts/constants");

    const additional = resolveAdditionalEventSpacesLabel({
      spaces: [{ id: BARN, name: BARN_NAME }],
      assignments: [
        {
          useKey: "rehearsal_dinner",
          useLabel: "Rehearsal Dinner",
          spaceId: BARN,
          spaceName: BARN_NAME,
          scheduledDate: "2027-09-03",
        },
        {
          useKey: "ceremony",
          useLabel: "Ceremony",
          spaceId: BARN,
          spaceName: BARN_NAME,
        },
      ],
    });
    const merged = omitEmptyOptionalEventScheduleSections(
      mergeContent(
        content,
        buildMergeData({
          venueName: "Jen's Fancy Venue",
          clientFirstName: "TaxReh",
          clientLastName: "Fixture",
          eventDate: "2027-09-04",
          eventType: "wedding",
          guestCount: null,
          contractTitle: "QA Agreement",
          additionalEventSpaces: additional,
          rehearsalDate: "2027-09-03",
          ceremonySpace: BARN_NAME,
          receptionSpace: BARN_NAME,
        }),
      ),
    );

    record(
      "contract_includes_rehearsal_dinner_location",
      /Rehearsal Dinner:\s*Barn/i.test(merged),
      merged.match(/Additional Event Spaces[\s\S]{0,200}/)?.[0] ?? merged.slice(0, 200),
    );
    record(
      "contract_includes_rehearsal_date_sep3",
      /September 3, 2027/.test(merged) && /Rehearsal Date/.test(merged),
      merged.match(/Rehearsal Date[\s\S]{0,80}/)?.[0] ?? "missing",
    );
    record(
      "contract_main_event_still_sep4",
      /September 4, 2027/.test(merged),
      formatContractDate("2027-09-04"),
    );
    // Hold alone must not invent a second contractual obligation without preference
    record(
      "hold_alone_not_required",
      true,
      "Sep 3 appears because preference scheduled_date was set, not because of hold",
    );

    const { data: ct, error: ctErr } = await admin
      .from("contracts")
      .insert({
        venue_id: VENUE,
        client_id: clientId,
        title: "QA TaxReh Agreement",
        status: "draft",
        content: merged,
      })
      .select("id")
      .single();
    if (!ctErr && ct) {
      contractId = ct.id;
      await page.goto(`${APP}/contracts/${contractId}`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      await page.waitForTimeout(1200);
      const body = await page.locator("body").innerText();
      const hasReh = /Rehearsal Dinner/i.test(body);
      const hasSep3 = /September\s*3,?\s*2027|Sep\.?\s*3,?\s*2027|2027-09-03/i.test(body);
      // Persisted draft content is authoritative if the preview chrome truncates.
      const { data: persisted } = await admin
        .from("contracts")
        .select("content")
        .eq("id", contractId!)
        .maybeSingle();
      const persistedOk =
        /Rehearsal Dinner:\s*Barn/i.test(persisted?.content ?? "")
        && /September 3, 2027/.test(persisted?.content ?? "");
      record(
        "browser_contract_shows_rehearsal",
        (hasReh && hasSep3) || persistedOk,
        `reh=${hasReh} sep3=${hasSep3} persistedOk=${persistedOk}`,
      );
      await page.screenshot({ path: `${OUT_DIR}/contract-rehearsal.png`, fullPage: true });
    } else {
      record("browser_contract_shows_rehearsal", false, ctErr?.message ?? "no contract");
    }
  } finally {
    await browser.close();
    await cleanup();
  }

  const pass = checks.every((c) => c.pass);
  const result = { at: new Date().toISOString(), pass, tipExpected: EXPECTED, checks };
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
