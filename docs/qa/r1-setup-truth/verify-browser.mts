/**
 * R1 — Inventory + Event Order setup truth (local dev server against Sandbox).
 * Start the app with COMMUNICATION_MODE=disabled, then:
 *   PHASE=view   npx tsx docs/qa/r1-setup-truth/verify-browser.mts   (read-only pages)
 *   PHASE=portal npx tsx docs/qa/r1-setup-truth/verify-browser.mts   (couple portal, existing token)
 *   PHASE=select npx tsx docs/qa/r1-setup-truth/verify-browser.mts   (Select toggle round-trip, restored)
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { inventoryCoupleBand, type InventoryCoupleBand } from "../../../lib/event-inventory/couple-bands";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "http://localhost:3000";
const EMAIL = "jennifer@hellotocheers.com";
const PHASE = process.env.PHASE ?? "view";
const OUT = "docs/qa/r1-setup-truth";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const FX = {
  inventoryDraft: { event: "5cd0be77-ec99-48c6-a86b-7235b3a65f76", client: "e4a6a755-a0d2-4e3c-b5f0-9f099355545a" },
  packet: { event: "ebf74f77-2944-474a-b735-48762ecb6842", client: "b4e2764b-be33-4579-89e3-0c8e4a6dd5be" },
  template: { event: "9c200402-5d76-4851-aa8e-ef3ffd823144", client: "21d9fa35-7a0d-42ce-8697-69a9bb202cde" },
  empty: { event: "9f569e99-cca9-4b5e-be5c-bbe0b60affc4", client: "97f64686-1b72-49d9-9f26-cc424fd6038b" },
  libraryTemplate: "0f7cb5d2-f2ef-4e47-bf25-309f8b60a330",
  portalSession: "f725ba07-adfd-41b5-b577-1b1edede01f6",
};

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: unknown) {
  const d = typeof detail === "string" ? detail : JSON.stringify(detail);
  checks.push({ name, pass, detail: d.slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${d.slice(0, 400)}`);
}

async function staffCookies() {
  const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email: EMAIL }),
  });
  if (!res.ok) throw new Error(`generate_link HTTP ${res.status}`);
  const body = (await res.json()) as { hashed_token?: string; properties?: { hashed_token?: string } };
  const hash = body.hashed_token ?? body.properties?.hashed_token;
  const { data: otp, error } = await anon.auth.verifyOtp({ type: "email", token_hash: hash! });
  if (error || !otp?.session) throw error ?? new Error("no session");
  const projectRef = new URL(url).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const chunked = ssrUtils.createChunks(cookieName, JSON.stringify(otp.session));
  return (Array.isArray(chunked) ? chunked : [{ name: cookieName, value: chunked }]).map(
    (c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const,
    }),
  );
}

type DbItem = { id: string; name: string; is_included: boolean | null; client_selectable: boolean | null; quantity: number; max_quantity?: number | null };
async function eventItems(eventId: string): Promise<DbItem[]> {
  const { data: inv } = await admin.from("event_inventory").select("id").eq("event_id", eventId).single();
  const { data } = await admin.from("event_inventory_items").select("*").eq("event_inventory_id", inv!.id).order("sort_order");
  return (data ?? []) as DbItem[];
}
const bandOf = (i: DbItem) =>
  inventoryCoupleBand({ isIncluded: i.is_included, clientSelectable: i.client_selectable, quantity: i.quantity, maxQuantity: i.max_quantity ?? null });

type Page = import("playwright").Page;
async function bandRows(page: Page, root = "") {
  return page.evaluate((rootSel: string) => {
    const scope = rootSel ? document.querySelector(rootSel) ?? document : document;
    const out: Record<string, string[]> = {};
    for (const band of ["couple_can_choose", "included", "additional_venue_sets"]) {
      const el = scope.querySelector(`[data-testid="inventory-band-${band}"]`);
      if (!el) continue;
      out[band] = Array.from(el.querySelectorAll(":scope > div.group, :scope div.group")).map(
        (row) => (row.querySelector("span.text-foreground, .text-foreground")?.textContent ?? "").trim(),
      );
    }
    return out;
  }, root);
}

function compareBands(label: string, ui: Record<string, string[]>, expected: Map<string, InventoryCoupleBand>, total: number) {
  const seen = new Map<string, string[]>();
  for (const [band, names] of Object.entries(ui)) for (const n of names) seen.set(n, [...(seen.get(n) ?? []), band]);
  const uiCount = Object.values(ui).reduce((s, r) => s + r.length, 0);
  const mismatches: string[] = [];
  for (const [name, band] of expected) {
    const got = seen.get(name) ?? [];
    if (got.length !== 1 || got[0] !== band) mismatches.push(`${name}: db=${band} ui=${got.join("|") || "missing"}`);
  }
  record(`${label}: every row classified exactly once, matching DB`, mismatches.length === 0 && uiCount === total, {
    uiCount, dbCount: total, bands: Object.fromEntries(Object.entries(ui).map(([b, r]) => [b, r.length])), mismatches,
  });
}

async function inventoryTab(page: Page, fx: { event: string; client: string }, tag: string, w: number) {
  await page.goto(`${APP}/clients/${fx.client}#inventory`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("inventory-visibility-disclosure").waitFor({ timeout: 90_000 });
  const items = await eventItems(fx.event);
  const names = items.map((i) => i.name);
  record(`${tag}@${w}: DB row names unique (name is a stable key here)`, new Set(names).size === names.length, { count: names.length });
  const expected = new Map(items.map((i) => [i.name, bandOf(i)] as const));
  compareBands(`${tag}@${w} S1`, await bandRows(page), expected, items.length);
  const disclosure = await page.getByTestId("inventory-visibility-disclosure").innerText();
  record(`${tag}@${w} S5: visibility disclosure`, /All inventory rows are currently visible to the couple/.test(disclosure), disclosure);
  const body = await page.locator("main").innerText();
  record(`${tag}@${w}: no Venue only band`, !/Venue only/i.test(body.replace(/Venue-only items are not supported yet/g, "")), "checked main text");
  const included = items.filter((i) => i.is_included);
  const toggleOnIncluded = await Promise.all(included.map((i) => page.getByTestId(`inventory-item-select-toggle-${i.id}`).count()));
  const additional = items.filter((i) => !i.is_included);
  const toggleOnAdditional = await Promise.all(additional.map((i) => page.getByTestId(`inventory-item-select-toggle-${i.id}`).count()));
  record(`${tag}@${w} S2: Select only on Additional rows`, toggleOnIncluded.every((c) => c === 0) && toggleOnAdditional.every((c) => c === 1), {
    includedWithToggle: toggleOnIncluded.filter((c) => c > 0).length, additionalWithToggle: toggleOnAdditional.filter((c) => c === 1).length, additional: additional.length,
  });
  const maxTexts = await page.locator('[data-testid="inventory-band-couple_can_choose"] >> text=/Couple can select \\(max ×\\d+\\)/').allInnerTexts();
  const choosable = items.filter((i) => bandOf(i) === "couple_can_choose");
  const expectedMax = choosable.map((i) => `Couple can select (max ×${i.max_quantity ?? i.quantity})`).sort();
  record(`${tag}@${w}: max shown only for couple-can-choose rows`, JSON.stringify(maxTexts.map((t) => t.trim()).sort()) === JSON.stringify(expectedMax)
    && (await page.locator("text=/Couple can select \\(max/").count()) === choosable.length, { ui: maxTexts, expectedMax });
  const lifecycle = { share: await page.getByTestId("inventory-share").count(), finalize: await page.getByTestId("inventory-finalize").count() };
  record(`${tag}@${w}: Share/Finalize controls preserved (not clicked)`, lifecycle.finalize === 1, lifecycle);
  await page.getByTestId("inventory-visibility-disclosure").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/shots/${tag}-inventory-${w}.png`, fullPage: true });
  return items;
}

async function eoTab(page: Page, fx: { event: string; client: string }, tag: string, w: number) {
  await page.goto(`${APP}/clients/${fx.client}#event-order`, { waitUntil: "domcontentloaded" });
  const section = page.getByTestId("eo-couple-will-choose");
  await section.waitFor({ timeout: 90_000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="eo-couple-will-choose"]')?.textContent?.includes("Loading"), null, { timeout: 30_000 });
  const { data: eo } = await admin.from("event_orders").select("id,template_id").eq("event_id", fx.event).single();
  const { data: lines } = await admin.from("event_order_lines").select("*").eq("event_order_id", eo!.id);
  const ls = (lines ?? []) as Array<{ is_included: boolean; unit_price: number | null; quantity: number; amount: number }>;
  const incl = ls.filter((l) => l.is_included).length;
  const zeroTags = await page.getByTestId("eo-line-included-extra").count();
  record(`${tag}@${w} S4: every Included line shows $0 extra`, zeroTags === incl, { includedLines: incl, ui: zeroTags });
  const additional = ls.filter((l) => !l.is_included);
  const unreconciled = additional.filter((l) => Math.abs(Number(l.amount) - Number(l.quantity) * Number(l.unit_price ?? 0)) > 0.005);
  const billable = ls.filter((l) => !l.is_included && Number(l.unit_price ?? 0) > 0 && Number(l.amount) > 0).reduce((s, l) => s + Number(l.amount), 0);
  const totalText = (await page.getByTestId("eo-additional-extra-total").count()) ? await page.getByTestId("eo-additional-extra-total").innerText() : "(no total — no lines)";
  const uiTotal = Number((totalText.match(/\$([\d,]+(?:\.\d+)?)/)?.[1] ?? "NaN").replace(/,/g, ""));
  record(`${tag}@${w} S4: Additional amounts = qty × price; extra total matches DB`, unreconciled.length === 0 && Math.abs(uiTotal - billable) < 0.005, {
    additionalLines: additional.length, unreconciled: unreconciled.length, dbBillable: billable, uiTotal, ui: totalText,
  });
  const source = await page.getByTestId("eo-couple-will-choose-source").getAttribute("data-source").catch(() => null);
  const empty = await page.getByTestId("eo-couple-will-choose-empty").count();
  const groups = await page.getByTestId("eo-couple-choice-group").count();
  const options = await page.getByTestId("eo-couple-choice-option").count();
  const rules = await page.getByTestId("eo-couple-choice-rule").allInnerTexts();
  const text = await section.innerText();
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/shots/${tag}-event-order-${w}.png`, fullPage: true });
  await section.screenshot({ path: `${OUT}/shots/${tag}-couple-will-choose-${w}.png` });
  return { source, empty, groups, options, rules, text, templateId: eo!.template_id as string | null };
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addCookies(await staffCookies());
  const results: Record<string, unknown> = { phase: PHASE, at: new Date().toISOString(), app: APP };

  if (PHASE === "view") {
    const { selectionDefinitionFromEventOrderTemplate } = await import("../../../lib/event-order-templates/selection-definition");
    const { getTemplateWithDetails } = await import("../../../lib/event-order-templates/repository");
    const { pickActiveChoices } = await import("../../../lib/client-choices/couple-choice-preview");
    for (const w of [1280, 390]) {
      const page = await ctx.newPage();
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const draftItems = await inventoryTab(page, FX.inventoryDraft, "draft-5cd0be77", w);
      await inventoryTab(page, FX.packet, "shared-ebf74f77", w);

      const tpl = await eoTab(page, FX.template, "template-9c200402", w);
      const tplDetail = await getTemplateWithDetails(admin as never, "a415ac52-cd74-42a6-8df7-7a8f6e71d080", tpl.templateId!);
      const def = selectionDefinitionFromEventOrderTemplate(tplDetail as never);
      record(`template-9c200402@${w} S3: template source groups/options match template definition`,
        tpl.source === "template" && tpl.groups === def.groups.length && tpl.options === def.options.length
          && tpl.text.includes(`“${tplDetail!.name}”`) && tpl.text.includes("not sent yet"),
        { source: tpl.source, template: tplDetail!.name, uiGroups: tpl.groups, defGroups: def.groups.length, uiOptions: tpl.options, defOptions: def.options.length, rules: tpl.rules });

      const pk = await eoTab(page, FX.packet, "packet-ebf74f77", w);
      const { data: chs } = await admin.from("client_choices").select("id,name,status,definition,answers").eq("event_id", FX.packet.event).order("created_at", { ascending: false });
      const active = pickActiveChoices((chs ?? []) as Array<{ id: string; status: string; name: string; answers: Record<string, { optionIds?: string[] }>; definition: { groups: unknown[]; options: unknown[] } }>);
      const chosenIds = Object.values(active!.answers ?? {}).flatMap((a) => a.optionIds ?? []);
      const uiChosen = await page.locator('[data-testid="eo-couple-choice-option"]', { hasText: "Selected" }).evaluateAll((els) => els.map((e) => e.getAttribute("data-option-id")));
      record(`packet-ebf74f77@${w} S3: packet source shows the active packet's frozen groups and submitted answers`,
        pk.source === "packet" && pk.text.includes(`“${active!.name}”`) && pk.groups === active!.definition.groups.length && pk.options === active!.definition.options.length
          && JSON.stringify([...uiChosen].sort()) === JSON.stringify([...chosenIds].sort()),
        { source: pk.source, activePacket: `${active!.id.slice(0, 8)} ${active!.name} (${active!.status})`, uiGroups: pk.groups, dbGroups: active!.definition.groups.length, uiOptions: pk.options, dbOptions: active!.definition.options.length, uiChosen, dbChosen: chosenIds });

      const em = await eoTab(page, FX.empty, "empty-9f569e99", w);
      record(`empty-9f569e99@${w} S3: empty state`, em.empty === 1 && em.groups === 0 && em.text.includes("No choices — the couple reviews only."), { text: em.text });

      await page.goto(`${APP}/library/inventory-templates/${FX.libraryTemplate}`, { waitUntil: "domcontentloaded" });
      await page.getByTestId("inventory-template-band-note").waitFor({ timeout: 90_000 });
      const { data: tItems } = await admin.from("inventory_template_items").select("*").eq("template_id", FX.libraryTemplate);
      const tExpected = new Map((tItems ?? []).map((i) => [i.name as string, inventoryCoupleBand({ isIncluded: i.is_included, quantity: i.quantity })] as const));
      compareBands(`library-0f7cb5d2@${w} S1`, await bandRows(page), tExpected, (tItems ?? []).length);
      const copyMismatch = draftItems.filter((i) => !i.client_selectable).filter((i) => tExpected.has(i.name) && tExpected.get(i.name) !== bandOf(i)).map((i) => i.name);
      const notInCopy = [...tExpected.keys()].filter((n) => !draftItems.some((i) => i.name === n));
      record(`library-0f7cb5d2@${w} S8: template bands = event copy (5cd0be77) bands for every shared row`, copyMismatch.length === 0, {
        templateRows: tExpected.size, eventCopyRows: draftItems.length, mismatches: copyMismatch, templateRowsNotInCopy: notInCopy,
      });
      await page.screenshot({ path: `${OUT}/shots/library-template-${w}.png`, fullPage: true });
      await page.close();
    }
  }

  if (PHASE === "portal") {
    const { data: sess } = await admin.from("client_portal_sessions").select("id,access_token").eq("client_id", FX.packet.client).eq("id", FX.portalSession);
    const token = (sess ?? [])[0]?.access_token as string;
    const api = await (await fetch(`${APP}/api/portal/inventory?token=${encodeURIComponent(token)}`)).json() as { inventory?: { items: Array<{ id: string; isIncluded: boolean; clientSelectable: boolean; name: string }> } };
    const portalItems = api.inventory?.items ?? [];
    const venueItems = await eventItems(FX.packet.event);
    const portalBand = new Map(portalItems.map((i) => [i.id, i.isIncluded ? "included" : i.clientSelectable ? "couple_can_choose" : "additional_venue_sets"]));
    const diff = venueItems.filter((i) => portalBand.get(i.id) !== bandOf(i)).map((i) => `${i.name}: venue=${bandOf(i)} portal=${portalBand.get(i.id) ?? "missing"}`);
    record("S6: venue bands = couple portal bands by stable row id", diff.length === 0 && portalItems.length === venueItems.length, {
      venueRows: venueItems.length, portalRows: portalItems.length, diff,
    });
    for (const w of [1280, 390]) {
      const page = await ctx.newPage();
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto(`${APP}/p/${token}?view=inventory`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(6000);
      const text = await page.locator("body").innerText();
      const choosable = venueItems.filter((i) => bandOf(i) === "couple_can_choose").map((i) => i.name);
      record(`S6@${w}: couple portal shows the couple-can-choose rows`, choosable.every((n) => text.includes(n)), { choosable });
      await page.screenshot({ path: `${OUT}/shots/portal-inventory-${w}.png`, fullPage: true });
      await page.close();
    }
  }

  async function waitForDb(id: string, want: boolean) {
    for (let i = 0; i < 40; i++) {
      const { data } = await admin.from("event_inventory_items").select("client_selectable").eq("id", id).single();
      if (data!.client_selectable === want) return data!;
      await new Promise((r) => setTimeout(r, 750));
    }
    const { data } = await admin.from("event_inventory_items").select("client_selectable").eq("id", id).single();
    return data!;
  }

  if (PHASE === "select") {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${APP}/clients/${FX.inventoryDraft.client}#inventory`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("inventory-visibility-disclosure").waitFor({ timeout: 90_000 });
    const items = await eventItems(FX.inventoryDraft.event);
    const target = items.find((i) => !i.is_included && !i.client_selectable)!;
    const toggle = page.getByTestId(`inventory-item-select-toggle-${target.id}`);
    const inBand = (band: string) => page.locator(`[data-testid="inventory-band-${band}"]`).getByText(target.name, { exact: true }).count();
    record("S2 select: starts in Additional — venue sets", (await inBand("additional_venue_sets")) === 1, target.name);
    await toggle.click();
    await page.locator('[data-testid="inventory-band-couple_can_choose"]').getByText(target.name, { exact: true }).waitFor({ timeout: 30_000 });
    const on = await waitForDb(target.id, true);
    record("S2 select: Select moves row to Couple can choose (UI + DB)", on!.client_selectable === true && (await inBand("couple_can_choose")) === 1
      && (await page.getByText(`Couple can select (max ×${target.max_quantity ?? target.quantity})`).count()) === 1, { db: on });
    await page.screenshot({ path: `${OUT}/shots/select-on-1280.png`, fullPage: true });
    await page.getByTestId(`inventory-item-select-toggle-${target.id}`).click();
    await page.locator('[data-testid="inventory-band-additional_venue_sets"]').getByText(target.name, { exact: true }).waitFor({ timeout: 30_000 });
    const off = await waitForDb(target.id, false);
    record("S2 select: toggle back restores Additional — venue sets (UI + DB)", off!.client_selectable === false && (await inBand("additional_venue_sets")) === 1, { db: off });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("inventory-visibility-disclosure").waitFor({ timeout: 90_000 });
    record("S2 select: after reload row is still Additional — venue sets", (await inBand("additional_venue_sets")) === 1, "reloaded");
    await page.screenshot({ path: `${OUT}/shots/select-restored-1280.png`, fullPage: true });
    await page.close();
  }

  await browser.close();
  results.checks = checks;
  results.pass = checks.every((c) => c.pass);
  writeFileSync(`${OUT}/browser-results-${PHASE}.json`, JSON.stringify(results, null, 2));
  console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} PASS`);
}

main().catch((e) => { console.error(e); process.exit(1); });
