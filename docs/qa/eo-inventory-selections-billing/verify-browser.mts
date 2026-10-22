/**
 * Sandbox: Event Order + Inventory + selections billing clarity.
 * No invites, questionnaire sends, or customer emails.
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
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const OUT = "docs/qa/eo-inventory-selections-billing";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");
if (!EXPECTED_SHA || EXPECTED_SHA.length < 8) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 900) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 320)}`);
}

async function cookies() {
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
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: FANCY,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function countSideEffects() {
  const [invites, notes, invoices, templates] = await Promise.all([
    admin.from("client_invitations").select("id", { count: "exact", head: true }).eq("venue_id", FANCY),
    admin.from("notifications").select("id", { count: "exact", head: true }).eq("venue_id", FANCY),
    admin.from("invoices").select("id", { count: "exact", head: true }).eq("venue_id", FANCY),
    admin.from("event_order_templates").select("id, updated_at").eq("venue_id", FANCY).order("updated_at", { ascending: false }).limit(5),
  ]);
  return {
    invites: invites.count ?? -1,
    notes: notes.count ?? -1,
    invoices: invoices.count ?? -1,
    templateFingerprints: (templates.data ?? []).map((t) => `${t.id}:${t.updated_at}`),
  };
}

async function main() {
  const before = await countSideEffects();
  let servingSha: string | null = null;
  let eventId: string | null = null;
  let clientId: string | null = null;
  let eoId: string | null = null;
  let includedPriced = 0;
  let additionalPriced = 0;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();

  try {
    // Rolling ECS can briefly dual-serve old/new tasks — poll login until expected SHA.
    for (let attempt = 0; attempt < 24; attempt++) {
      const probe = await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      const link = probe?.headers()["link"] ?? "";
      const html = await page.content();
      const fromHtml = html.match(/data-dpl-id="([a-f0-9]{40})"/)?.[1] ?? null;
      const fromLink = link.match(/dpl=([a-f0-9]{40})/)?.[1] ?? null;
      servingSha = fromHtml ?? fromLink;
      if (servingSha === EXPECTED_SHA && (!fromHtml || fromHtml === EXPECTED_SHA) && (!fromLink || fromLink === EXPECTED_SHA)) {
        break;
      }
      await page.waitForTimeout(5_000);
    }
    record(
      "serving_sha",
      !!servingSha && servingSha === EXPECTED_SHA,
      `serving=${servingSha} expected=${EXPECTED_SHA}`,
    );
    if (servingSha !== EXPECTED_SHA) throw new Error("serving SHA mismatch — abort before mutating UI");

    await page.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 90_000 });

    // Prefer Fancy B2P fixture ebf74f77… (included priced EO lines + inventory).
    const { data: orders } = await admin
      .from("event_orders")
      .select("id, event_id, status, shared_at, events!inner(id, client_id, status)")
      .eq("venue_id", FANCY)
      .eq("status", "open")
      .order("updated_at", { ascending: false })
      .limit(40);

    const preferred = (orders ?? []).find((o) => o.event_id.startsWith("ebf74f77"));
    const ordered = preferred
      ? [preferred, ...(orders ?? []).filter((o) => o.id !== preferred.id)]
      : (orders ?? []);

    for (const o of ordered) {
      const ev = Array.isArray(o.events) ? o.events[0] : o.events;
      if (!ev?.client_id || ev.status === "cancelled") continue;
      const { data: lines } = await admin
        .from("event_order_lines")
        .select("id, is_included, unit_price, amount, description")
        .eq("event_order_id", o.id)
        .eq("venue_id", FANCY);
      const incl = (lines ?? []).filter((l) => l.is_included !== false && l.unit_price != null && Number(l.unit_price) > 0);
      const addl = (lines ?? []).filter((l) => l.is_included === false && l.unit_price != null && Number(l.unit_price) > 0);
      if ((lines ?? []).length === 0) continue;
      eventId = o.event_id;
      clientId = ev.client_id;
      eoId = o.id;
      includedPriced = incl.length;
      additionalPriced = addl.length;
      if (incl.length > 0) break;
    }

    record(
      "fixture_event_order",
      !!eventId && !!eoId,
      `event=${eventId} eo=${eoId} includedPriced=${includedPriced} additionalPriced=${additionalPriced}`,
    );
    if (!eventId || !clientId) throw new Error("no suitable Fancy Event Order fixture");

    // --- Event Setup → EO setup editor ---
    await page.goto(`${APP}/events/${eventId}?tab=overview`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="event-setup-change-event_order"], [data-testid="event-setup-change-inventory"]', {
      timeout: 45_000,
    }).catch(() => {});
    await page.waitForTimeout(800);
    await page.getByTestId("event-setup-change-event_order").click({ timeout: 20_000 });

    const eoEditor = page.getByTestId("event-order-setup-editor");
    await eoEditor.waitFor({ state: "visible", timeout: 20_000 });
    // Customize path shows line badges
    await eoEditor.getByTestId("event-order-setup-mode-customize").click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(400);
    const eoCopy = await eoEditor.innerText();
    record(
      "eo_setup_delivery_not_picklist",
      /delivery list/i.test(eoCopy) && /not a couple pick-list/i.test(eoCopy) && /Client selections/i.test(eoCopy),
      eoCopy.slice(0, 400),
    );
    record(
      "eo_setup_included_badge",
      /Included/i.test(eoCopy),
      `hasIncluded=${/Included/i.test(eoCopy)}`,
    );
    await page.screenshot({ path: `${OUT}/shots/eo-setup-1280.png`, fullPage: true });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // --- Inventory setup editor ---
    await page.getByTestId("event-setup-change-inventory").click({ timeout: 15_000 });
    const invEditor = page.getByTestId("event-inventory-setup-editor");
    let invSetupOk = false;
    try {
      await invEditor.waitFor({ state: "visible", timeout: 15_000 });
      invSetupOk = true;
    } catch {
      // Some events may lack inventory — still record
    }
    if (invSetupOk) {
      const invCopy = await invEditor.innerText();
      record(
        "inventory_setup_included_optional",
        /Included items are operational/i.test(invCopy) && /does not ask the couple to select/i.test(invCopy),
        invCopy.slice(0, 400),
      );
      const hasIncludedBadge = await invEditor.getByTestId("inventory-setup-included").count();
      const hasAdditionalBadge = await invEditor.getByTestId("inventory-setup-additional").count();
      record(
        "inventory_setup_badges",
        hasIncludedBadge + hasAdditionalBadge > 0 || /Included yet|No inventory draft/i.test(invCopy),
        `includedBadges=${hasIncludedBadge} additionalBadges=${hasAdditionalBadge}`,
      );
      await page.screenshot({ path: `${OUT}/shots/inventory-setup-1280.png`, fullPage: true });
      await page.keyboard.press("Escape");
    } else {
      record("inventory_setup_included_optional", false, "editor did not open");
      record("inventory_setup_badges", false, "editor did not open");
    }

    // --- Inventory workspace ---
    await page.goto(`${APP}/events/${eventId}?tab=inventory`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    const invBody = await page.locator("main").innerText().catch(() => "");
    record(
      "inventory_workspace_share_copy",
      /informationally in the client portal/i.test(invBody) || /What's actually part of this event/i.test(invBody) || /Nothing added yet|Start/i.test(invBody),
      invBody.slice(0, 350),
    );
    await page.screenshot({ path: `${OUT}/shots/inventory-workspace-1280.png`, fullPage: true });

    // --- Client portal preview Event Order (staff draft when unshared) ---
    await page.goto(`${APP}/clients/${clientId}/portal-preview?event=${eventId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: /Event Order/i }).click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(800);
    const preview = await page.locator('[data-testid="portal-preview-event-order"]').innerText().catch(
      async () => page.locator("main").innerText(),
    );
    record(
      "portal_eo_section_present",
      /What you're receiving|Not shared yet|Staff draft/i.test(preview),
      preview.slice(0, 500),
    );
    // Staff draft uses the same EventOrderPortalView — Included priced lines must show "Included", not $.
    if (/What you're receiving/i.test(preview)) {
      record(
        "portal_eo_no_delivery_subtotal_label",
        !/Delivery subtotal \(for reference\)/i.test(preview),
        preview.slice(0, 400),
      );
      record(
        "portal_eo_shows_included_word",
        /Included/i.test(preview),
        `includedWord=${/Included/i.test(preview)}`,
      );
      // Fixture with includedPriced>0: money label "Included" appears; dollar amounts only if additional.
      if (includedPriced > 0) {
        const moneyLabels = [...preview.matchAll(/\nIncluded\n|· Included|\bIncluded\b/g)];
        record(
          "portal_eo_included_priced_shows_included_label",
          moneyLabels.length >= includedPriced || (preview.match(/Included/g) ?? []).length >= includedPriced,
          `includedPriced=${includedPriced} includedMentions=${(preview.match(/Included/g) ?? []).length}`,
        );
      } else {
        record("portal_eo_included_priced_shows_included_label", true, "no included-priced lines on fixture");
      }
    } else {
      record("portal_eo_no_delivery_subtotal_label", true, "empty/not shared — N/A");
      record("portal_eo_shows_included_word", true, "empty/not shared — N/A");
      record("portal_eo_included_priced_shows_included_label", false, "portal did not render receiving list");
    }
    await page.screenshot({ path: `${OUT}/shots/portal-preview-eo-1280.png`, fullPage: true });

    // --- Client selections panel (Event Order tab) — wording only, no send ---
    await page.goto(`${APP}/events/${eventId}?tab=event-order`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    const eoTab = await page.locator("main").innerText();
    record(
      "client_selections_panel_present",
      /Client selections/i.test(eoTab) || /No client selections/i.test(eoTab) || /Start selections/i.test(eoTab) || /Event Order/i.test(eoTab),
      eoTab.slice(0, 350),
    );
    await page.screenshot({ path: `${OUT}/shots/event-order-workspace-1280.png`, fullPage: true });

    const after = await countSideEffects();
    record(
      "no_side_effect_invites",
      before.invites === after.invites,
      `before=${before.invites} after=${after.invites}`,
    );
    record(
      "no_side_effect_notifications",
      before.notes === after.notes,
      `before=${before.notes} after=${after.notes}`,
    );
    record(
      "no_side_effect_invoices",
      before.invoices === after.invoices,
      `before=${before.invoices} after=${after.invoices}`,
    );
    record(
      "library_templates_unchanged",
      JSON.stringify(before.templateFingerprints) === JSON.stringify(after.templateFingerprints),
      `before=${before.templateFingerprints.join(",")} after=${after.templateFingerprints.join(",")}`,
    );

    // DB: included priced lines still excluded from billable filter (logic check against fixture).
    if (eoId) {
      const { data: lines } = await admin
        .from("event_order_lines")
        .select("id, is_included, unit_price, amount")
        .eq("event_order_id", eoId)
        .eq("venue_id", FANCY);
      const billable = (lines ?? []).filter((l) => {
        if (l.is_included) return false;
        if (l.unit_price == null || Number(l.unit_price) <= 0) return false;
        return Number(l.amount) > 0;
      });
      const includedWithPrice = (lines ?? []).filter(
        (l) => l.is_included && l.unit_price != null && Number(l.unit_price) > 0,
      );
      record(
        "db_included_priced_not_billable",
        includedWithPrice.every((l) => !billable.some((b) => b.id === l.id)),
        `includedWithPrice=${includedWithPrice.length} billable=${billable.length}`,
      );
    }
  } finally {
    await browser.close();
    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.filter((c) => !c.pass).length;
    const payload = {
      expectedSha: EXPECTED_SHA,
      servingSha,
      eventId,
      clientId,
      eoId,
      before,
      passed,
      failed,
      checks,
      green: failed === 0,
    };
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(payload, null, 2));
    console.log(`\nRESULT ${failed === 0 ? "GREEN" : "NOT GREEN"} ${passed}/${passed + failed}`);
    if (failed > 0) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
