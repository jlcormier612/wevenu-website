/**
 * Sandbox E2E: Inventory + Event Order portal discoverability, sharing boundary,
 * template isolation, and authorization. Fancy only. No Production.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const JEN = "67458154-e6fe-41e3-830e-ea39844e4e19";
const SPACE = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "REPLACE_AFTER_DEPLOY";
const OUT = "docs/qa/inventory-event-order-portal";
const FIXTURE = "InvEoPortal";
const CLIENT_COOKIE = "sb-wvpsldwwjqdannqasrdf-client-auth-token";
const PASSWORD = "TempInvEoPortal1!";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1200) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 320)}`);
}

async function dismissWelcome(page: {
  locator: (s: string) => { isVisible: (o?: object) => Promise<boolean> };
  getByRole: (role: string, opts?: object) => {
    isVisible: (o?: object) => Promise<boolean>;
    click: (o?: object) => Promise<void>;
    check: (o?: object) => Promise<void>;
    innerText: () => Promise<string>;
  };
  waitForTimeout: (ms: number) => Promise<void>;
}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const welcome = page.locator('[data-welcome-experience="true"]');
    if (!(await welcome.isVisible().catch(() => false))) return;
    const agree = page.getByRole("checkbox");
    if (await agree.isVisible().catch(() => false)) {
      await agree.check({ force: true }).catch(async () => { await agree.click({ force: true }); });
    }
    const cont = page.getByRole("button", { name: /^(Continue|Saving)/i });
    if (await cont.isVisible().catch(() => false)) {
      const label = await cont.innerText().catch(() => "");
      if (/Continue/i.test(label)) await cont.click().catch(() => undefined);
    }
    await page.waitForTimeout(2000);
  }
}

async function cleanup(email?: string) {
  const { data: clients } = await admin.from("clients").select("id, lead_id").eq("venue_id", FANCY).eq("first_name", FIXTURE);
  for (const client of clients ?? []) {
    const { data: events } = await admin.from("events").select("id").eq("client_id", client.id);
    for (const event of events ?? []) {
      const { data: eos } = await admin.from("event_orders").select("id").eq("event_id", event.id);
      for (const eo of eos ?? []) {
        await admin.from("event_order_share_snapshots").delete().eq("event_order_id", eo.id);
        await admin.from("event_order_lines").delete().eq("event_order_id", eo.id);
        await admin.from("event_order_sections").delete().eq("event_order_id", eo.id);
      }
      await admin.from("event_orders").delete().eq("event_id", event.id);
      const { data: invs } = await admin.from("event_inventory").select("id").eq("event_id", event.id);
      for (const inv of invs ?? []) {
        await admin.from("event_inventory_items").delete().eq("event_inventory_id", inv.id);
        await admin.from("event_inventory_activities").delete().eq("event_inventory_id", inv.id);
      }
      await admin.from("event_inventory").delete().eq("event_id", event.id);
      await admin.from("events").delete().eq("id", event.id);
    }
    await admin.from("couple_guests").delete().eq("client_id", client.id);
    await admin.from("client_portal_sessions").delete().eq("client_id", client.id);
    await admin.from("clients").delete().eq("id", client.id);
    if (client.lead_id) await admin.from("leads").delete().eq("id", client.lead_id);
  }
  if (email) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const u of list?.users ?? []) {
      if (u.email === email) await admin.auth.admin.deleteUser(u.id);
    }
  }
}

async function createFixture(email: string, eventDate: string, tag: string) {
  const { data: relId, error: relErr } = await admin.rpc("find_or_create_relationship", {
    p_venue_id: FANCY, p_email: email, p_first_name: FIXTURE, p_last_name: "Discover",
  });
  if (relErr || !relId) throw relErr ?? new Error("rel");

  const { data: lead } = await admin.from("leads").insert({
    venue_id: FANCY, relationship_id: relId, first_name: FIXTURE, last_name: "Discover",
    email, event_type: "wedding", event_date: eventDate, guest_count: 80,
    status: "active", sales_stage: "proposal_sent", assigned_staff_id: JEN,
    planned_event_space_id: SPACE,
  }).select("id").single();

  const { data: client } = await admin.from("clients").insert({
    venue_id: FANCY, lead_id: lead!.id, first_name: FIXTURE, last_name: "Discover",
    email, status: "booking", event_type: "wedding", event_date: eventDate,
    relationship_id: relId, lifecycle_booked_at: new Date().toISOString(),
  }).select("id").single();

  const { data: event } = await admin.from("events").insert({
    venue_id: FANCY, client_id: client!.id, name: `${tag} InvEo Wedding`,
    event_type: "wedding", event_date: eventDate, start_time: "16:00", end_time: "22:00",
    guest_count: 80, status: "confirmed", space_id: SPACE, assigned_staff_id: JEN,
    booked_at: new Date().toISOString(),
  }).select("id").single();

  const token = `inveo_${tag}_${randomBytes(3).toString("hex")}`;
  await admin.from("client_portal_sessions").insert({
    venue_id: FANCY, client_id: client!.id, access_token: token,
    access_level: "couple", label: "Inv EO discover",
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
  });

  const { error: createErr } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (createErr && !/already/i.test(createErr.message)) throw createErr;

  return { clientId: client!.id, eventId: event!.id, token };
}

async function main() {
  const stamp = Date.now();
  const dateA = `2077-04-${String((stamp % 27) + 1).padStart(2, "0")}`;
  const dateB = `2077-09-${String((stamp % 27) + 1).padStart(2, "0")}`;
  const emailA = `inveo-a-${stamp}@hellotocheers-test.invalid`;
  const emailB = `inveo-b-${stamp}@hellotocheers-test.invalid`;
  let browser: { close: () => Promise<void> } | null = null;
  let templateId: string | null = null;
  let templateLineCountBefore = 0;

  await cleanup();
  for (const e of [emailA, emailB]) await cleanup(e).catch(() => undefined);

  try {
    const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
    const servingSha = (loginHtml.match(/dpl=([a-f0-9]{40})/) ?? [])[1] ?? null;
    record(
      "serving_sha",
      !!servingSha && servingSha.startsWith(EXPECTED_SHA.slice(0, 8)),
      `serving=${servingSha} expected=${EXPECTED_SHA}`,
    );
    if (!servingSha?.startsWith(EXPECTED_SHA.slice(0, 8))) {
      throw new Error(`serving ${servingSha}, expected ${EXPECTED_SHA}`);
    }

    const { data: tpl } = await admin.from("event_order_templates")
      .select("id,name")
      .eq("venue_id", FANCY)
      .eq("is_archived", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    templateId = tpl?.id ?? null;
    if (templateId) {
      const { count } = await admin.from("event_order_template_lines")
        .select("id", { count: "exact", head: true })
        .eq("template_id", templateId);
      templateLineCountBefore = count ?? 0;
    }
    record("template_baseline", Boolean(templateId), JSON.stringify({ templateId, templateLineCountBefore }));

    const fixture = await createFixture(emailA, dateA, `a${stamp}`);
    const other = await createFixture(emailB, dateB, `b${stamp}`);

    // Draft event inventory (unshared)
    const { data: inv } = await admin.from("event_inventory").insert({
      venue_id: FANCY, event_id: fixture.eventId, status: "draft",
    }).select("id").single();
    await admin.from("event_inventory_items").insert({
      venue_id: FANCY, event_inventory_id: inv!.id,
      name: "Gap Closure Cocktail Tables", category: "Tables",
      quantity: 8, unit_price: null, is_included: true, sort_order: 1,
    });

    // Event order draft with a line (unshared)
    const { data: eo } = await admin.from("event_orders").insert({
      venue_id: FANCY, event_id: fixture.eventId, client_id: fixture.clientId,
      status: "open", revision: 1, template_id: templateId,
    }).select("id").single();
    const { data: sec } = await admin.from("event_order_sections").insert({
      venue_id: FANCY, event_order_id: eo!.id, name: "Reception", sort_order: 1,
    }).select("id").single();
    await admin.from("event_order_lines").insert({
      venue_id: FANCY, event_order_id: eo!.id, section_id: sec!.id,
      provenance: "custom",
      description: "Gap Closure Banquet Tables", quantity: 10, amount: 0,
      is_included: true, unit: "each", unit_price: 0, sort_order: 1,
    });

    // Scenario C — unshared privacy (API)
    const unsharedInv = await anon.rpc("get_event_inventory_for_portal", { p_token: fixture.token });
    const unsharedEo = await anon.rpc("get_event_order_for_portal", { p_token: fixture.token });
    record(
      "scenario_c_unshared_api",
      (unsharedInv.data?.length ?? 0) === 0 && (unsharedEo.data?.length ?? 0) === 0,
      JSON.stringify({ inv: unsharedInv.data, eo: unsharedEo.data }),
    );

    // Browser — discover empty destinations
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    let session = (await anon.auth.signInWithPassword({ email: emailA, password: PASSWORD })).data.session;
    if (!session) {
      const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: emailA });
      session = (await anon.auth.verifyOtp({
        type: "email",
        token_hash: linkData!.properties!.hashed_token!,
      })).data.session;
    }
    if (!session) throw new Error("session");
    const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(session));
    await context.addCookies(
      ssrUtils.createChunks(CLIENT_COOKIE, encoded).map((c: { name: string; value: string }) => ({
        name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
        httpOnly: false, secure: true, sameSite: "Lax" as const,
      })),
    );

    await page.goto(`${APP}/p/${fixture.token}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await dismissWelcome(page);
    await page.waitForTimeout(1500);
    // Scroll home so Working With Your Venue cards are in view.
    await page.evaluate(() => window.scrollTo(0, 800)).catch(() => undefined);
    await page.waitForTimeout(500);
    const homeInv = await page.locator("[data-testid=portal-home-inventory-entry]").count();
    const homeEo = await page.locator("[data-testid=portal-home-event-order-entry]").count();
    const navDesktop = await page.locator('[data-portal-nav="desktop"]').innerText().catch(() => "");
    record(
      "scenario_a_home_entries",
      homeInv > 0 && homeEo > 0,
      `inv=${homeInv} eo=${homeEo} nav=${navDesktop.slice(0, 200)}`,
    );
    await page.screenshot({ path: `${OUT}/home-1280.png`, fullPage: true });

    if (homeInv > 0) {
      await page.locator("[data-testid=portal-home-inventory-entry]").click();
      await page.waitForTimeout(1200);
      const emptyInv = await page.locator("[data-testid=inventory-portal-empty]").count();
      record("scenario_a_inventory_empty", emptyInv > 0, `empty=${emptyInv}`);
      await page.screenshot({ path: `${OUT}/inventory-unshared-1280.png`, fullPage: true });
    } else {
      // Fallback: deep-link still must show empty state when capability is on.
      await page.goto(`${APP}/p/${fixture.token}#inventory`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1200);
      await dismissWelcome(page);
      const emptyInv = await page.locator("[data-testid=inventory-portal-empty]").count();
      record("scenario_a_inventory_empty", emptyInv > 0, `homeMissing fallback empty=${emptyInv}`);
      await page.screenshot({ path: `${OUT}/inventory-unshared-1280.png`, fullPage: true });
    }

    await page.goto(`${APP}/p/${fixture.token}#event-order`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await dismissWelcome(page);
    await page.waitForTimeout(1000);
    const emptyEo = await page.locator("[data-testid=event-order-portal-empty]").count();
    record("scenario_c_portal_empty_order", emptyEo > 0, `empty=${emptyEo}`);
    await page.screenshot({ path: `${OUT}/event-order-unshared-1280.png`, fullPage: true });

    // Scenario D — share inventory + EO
    await admin.from("event_inventory").update({ status: "shared" }).eq("id", inv!.id);
    const payload = {
      sections: [{ id: sec!.id, name: "Reception" }],
      lines: [{
        id: randomBytes(16).toString("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5"),
        description: "Gap Closure Banquet Tables",
        quantity: 10,
        amount: 0,
        sectionId: sec!.id,
        isIncluded: true,
        unit: "each",
        unitPrice: 0,
        notes: null,
        sortOrder: 1,
      }],
    };
    // Use real line id
    const { data: lineRow } = await admin.from("event_order_lines").select("id").eq("event_order_id", eo!.id).single();
    payload.lines[0].id = lineRow!.id;
    await admin.from("event_order_share_snapshots").insert({
      venue_id: FANCY, event_order_id: eo!.id, revision: 1, payload, shared_at: new Date().toISOString(),
    });
    await admin.from("event_orders").update({ shared_at: new Date().toISOString() }).eq("id", eo!.id);

    const sharedInv = await anon.rpc("get_event_inventory_for_portal", { p_token: fixture.token });
    const sharedEo = await anon.rpc("get_event_order_for_portal", { p_token: fixture.token });
    const invOk = (sharedInv.data ?? []).some((r: { item_name?: string }) => /Cocktail Tables/i.test(r.item_name ?? ""));
    const eoOk = (sharedEo.data ?? []).some((r: { line_description?: string }) => /Banquet Tables/i.test(r.line_description ?? ""));
    record("scenario_d_shared_api", invOk && eoOk, JSON.stringify({ inv: sharedInv.data?.[0], eo: sharedEo.data?.[0] }));

    await page.goto(`${APP}/p/${fixture.token}#inventory`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await dismissWelcome(page);
    await page.waitForTimeout(1000);
    const invView = await page.locator("[data-testid=inventory-portal-view]").count();
    const invText = await page.locator("body").innerText();
    record(
      "scenario_d_inventory_visible",
      invView > 0 && /Cocktail Tables/i.test(invText),
      invText.slice(0, 400),
    );
    await page.screenshot({ path: `${OUT}/inventory-shared-1280.png`, fullPage: true });

    await page.goto(`${APP}/p/${fixture.token}#event-order`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await dismissWelcome(page);
    await page.waitForTimeout(1000);
    const eoView = await page.locator("[data-testid=event-order-portal-view]").count();
    const eoText = await page.locator("body").innerText();
    record(
      "scenario_d_event_order_visible",
      eoView > 0 && /Banquet Tables/i.test(eoText),
      eoText.slice(0, 400),
    );
    await page.screenshot({ path: `${OUT}/event-order-shared-1280.png`, fullPage: true });

    // Scenario F — isolation
    const otherInv = await anon.rpc("get_event_inventory_for_portal", { p_token: other.token });
    const otherEo = await anon.rpc("get_event_order_for_portal", { p_token: other.token });
    record(
      "scenario_f_isolation",
      (otherInv.data?.length ?? 0) === 0 && (otherEo.data?.length ?? 0) === 0,
      JSON.stringify({ otherInv: otherInv.data, otherEo: otherEo.data }),
    );

    // Scenario B/E — template isolation after event-order edit
    await admin.from("event_order_lines").update({ quantity: 12, description: "Gap Closure Banquet Tables (edited)" })
      .eq("event_order_id", eo!.id);
    if (templateId) {
      const { count } = await admin.from("event_order_template_lines")
        .select("id", { count: "exact", head: true })
        .eq("template_id", templateId);
      record(
        "scenario_b_template_isolation",
        (count ?? 0) === templateLineCountBefore,
        `before=${templateLineCountBefore} after=${count}`,
      );
    } else {
      record("scenario_b_template_isolation", false, "no template");
    }

    // Re-share snapshot semantics: portal still shows prior snapshot until new share
    const afterEditEo = await anon.rpc("get_event_order_for_portal", { p_token: fixture.token });
    const stillOld = (afterEditEo.data ?? []).some(
      (r: { line_description?: string; line_quantity?: number }) =>
        r.line_description === "Gap Closure Banquet Tables" && Number(r.line_quantity) === 10,
    );
    record(
      "scenario_e_snapshot_until_reshare",
      stillOld,
      JSON.stringify(afterEditEo.data?.[0]),
    );

    // Nav labels present (desktop)
    await page.goto(`${APP}/p/${fixture.token}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await dismissWelcome(page);
    await page.waitForTimeout(1000);
    const navHtml = await page.locator('[data-portal-nav="desktop"]').innerText().catch(() => "");
    record(
      "scenario_g_nav_labels",
      /Inventory|Included/i.test(navHtml) && /Event Order|Order/i.test(navHtml),
      navHtml.slice(0, 300),
    );

    // Mobile width home entries
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/p/${fixture.token}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await dismissWelcome(page);
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 900)).catch(() => undefined);
    await page.waitForTimeout(400);
    const mobileHome = await page.locator("[data-testid=portal-home-inventory-order]").count();
    const moreBtn = await page.locator("[data-portal-more-trigger]").count();
    let moreHasInv = false;
    let moreHasEo = false;
    if (moreBtn > 0) {
      await page.locator("[data-portal-more-trigger]").click().catch(() => undefined);
      await page.waitForTimeout(600);
      const moreText = await page.locator("[data-portal-more-item]").allInnerTexts().catch(() => [] as string[]);
      const joined = moreText.join(" | ");
      moreHasInv = /Inventory|Included/i.test(joined);
      moreHasEo = /Event Order|Order/i.test(joined);
    }
    record(
      "scenario_g_mobile_home",
      mobileHome > 0 || (moreHasInv && moreHasEo),
      `home=${mobileHome} moreInv=${moreHasInv} moreEo=${moreHasEo}`,
    );
    await page.screenshot({ path: `${OUT}/home-390.png`, fullPage: true });
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err));
  } finally {
    await browser?.close().catch(() => undefined);
    await cleanup().catch(() => undefined);
    for (const e of [emailA, emailB]) await cleanup(e).catch(() => undefined);

    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.filter((c) => !c.pass).length;
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ expectedSha: EXPECTED_SHA, passed, failed, checks }, null, 2));
    writeFileSync(
      `${OUT}/browser-run.log`,
      checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n") + `\npassed=${passed} failed=${failed}\n`,
    );
    console.log(`\n${failed === 0 ? "GREEN" : "NOT GREEN"} passed=${passed} failed=${failed}`);
    process.exit(failed === 0 ? 0 : 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
