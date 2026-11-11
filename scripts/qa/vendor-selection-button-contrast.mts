/**
 * Sandbox browser proof: vendor-selection confirmation Back / Submit contrast.
 * Creates a disposable Fancy fixture with a pending pick, opens the confirm panel,
 * measures computed FG/BG + WCAG ratio at 1280 and 390, then cleans up.
 *
 * EXPECTED_SHA=<40-char> npx tsx scripts/qa/vendor-selection-button-contrast.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const JEN = "67458154-e6fe-41e3-830e-ea39844e4e19";
const SPACE = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const HARAH = "42a8d273-f738-4f3c-bdcd-f2a5a237e1b3";
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "";
const OUT = "docs/qa/vendor-selection-button-contrast";
const FIXTURE = "VendorBtnContrast";
const PASSWORD = "TempVendorContrast1!";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 900) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 280)}`);
}

function channel(v: number) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function parseCssColor(input: string): [number, number, number, number] | null {
  const rgb = input.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] == null ? 1 : Number(rgb[4])];
  return null;
}
function composite(fg: [number, number, number, number], bg: [number, number, number]): [number, number, number] {
  const a = fg[3];
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
  ];
}
function luminance(rgb: [number, number, number]) {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}
function contrast(fgCss: string, bgCss: string, parentBgCss?: string): number | null {
  const fg = parseCssColor(fgCss);
  let bg = parseCssColor(bgCss);
  if (!fg || !bg) return null;
  if (bg[3] < 0.999 && parentBgCss) {
    const parent = parseCssColor(parentBgCss);
    if (parent) {
      const solid = composite([bg[0], bg[1], bg[2], bg[3]], [parent[0], parent[1], parent[2]]);
      bg = [solid[0], solid[1], solid[2], 1];
    }
  }
  const solidFg = fg[3] < 0.999 && bg
    ? composite(fg, [bg[0], bg[1], bg[2]])
    : [fg[0], fg[1], fg[2]] as [number, number, number];
  const L1 = luminance(solidFg);
  const L2 = luminance([bg[0], bg[1], bg[2]]);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function cleanup(email?: string) {
  const { data: clients } = await admin.from("clients").select("id, lead_id").eq("venue_id", FANCY).eq("first_name", FIXTURE);
  for (const client of clients ?? []) {
    const { data: events } = await admin.from("events").select("id").eq("client_id", client.id);
    for (const event of events ?? []) {
      await admin.from("event_vendor_recommendations").delete().eq("event_id", event.id);
      await admin.from("event_vendor_assignments").delete().eq("event_id", event.id);
      await admin.from("events").delete().eq("id", event.id);
    }
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
    await page.waitForTimeout(1500);
  }
}

async function main() {
  if (!/^[a-f0-9]{40}$/.test(EXPECTED_SHA)) {
    throw new Error("EXPECTED_SHA must be the 40-char commit to verify");
  }
  const stamp = Date.now();
  const tag = `${FIXTURE}-${stamp}-${randomBytes(2).toString("hex")}`;
  const email = `vendor-btn-contrast-${stamp}@hellotocheers-test.invalid`;
  const eventDate = `2079-09-18`;
  let token = "";

  await cleanup(email);
  try {
    const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
    const servingSha = (loginHtml.match(/dpl=([a-f0-9]{40})/) ?? [])[1]
      ?? (loginHtml.match(/data-dpl-id="([a-f0-9]{40})"/) ?? [])[1]
      ?? null;
    record("serving_sha", servingSha === EXPECTED_SHA, `serving=${servingSha} expected=${EXPECTED_SHA}`);
    if (servingSha !== EXPECTED_SHA) {
      writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ expectedSha: EXPECTED_SHA, servingSha, checks }, null, 2));
      console.log("\nNOT GREEN — wrong SHA");
      process.exit(1);
    }

    const { data: relId, error: relErr } = await admin.rpc("find_or_create_relationship", {
      p_venue_id: FANCY, p_email: email, p_first_name: FIXTURE, p_last_name: "Fix",
    });
    if (relErr || !relId) throw relErr ?? new Error("rel");

    const { data: lead, error: leadErr } = await admin.from("leads").insert({
      venue_id: FANCY, relationship_id: relId, first_name: FIXTURE, last_name: "Fix",
      email, event_type: "wedding", event_date: eventDate, guest_count: 80,
      status: "active", sales_stage: "proposal_sent", assigned_staff_id: JEN,
      planned_event_space_id: SPACE,
    }).select("id").single();
    if (leadErr || !lead) throw leadErr ?? new Error("lead");

    const { data: client, error: clientErr } = await admin.from("clients").insert({
      venue_id: FANCY, lead_id: lead.id, first_name: FIXTURE, last_name: "Fix",
      email, status: "booking", event_type: "wedding", event_date: eventDate,
      relationship_id: relId, lifecycle_booked_at: new Date().toISOString(),
    }).select("id").single();
    if (clientErr || !client) throw clientErr ?? new Error("client");

    const { data: event, error: eventErr } = await admin.from("events").insert({
      venue_id: FANCY, client_id: client.id, name: `${tag} Wedding`,
      event_type: "wedding", event_date: eventDate, start_time: "16:00", end_time: "22:00",
      guest_count: 80, status: "confirmed", space_id: SPACE, assigned_staff_id: JEN,
      booked_at: new Date().toISOString(),
    }).select("id").single();
    if (eventErr || !event) throw eventErr ?? new Error("event");

    token = `vbc_${tag}_${randomBytes(3).toString("hex")}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY, client_id: client.id, access_token: token,
      access_level: "couple", label: "Vendor btn contrast",
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    });

    await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }).catch(() => undefined);

    // Ensure Harah is available to pick: recommendation + private pick pending submit
    const { error: recErr } = await admin.from("event_vendor_recommendations").upsert({
      venue_id: FANCY,
      event_id: event.id,
      vendor_id: HARAH,
      preference_level: "preferred",
      is_required: false,
      picked_at: new Date().toISOString(),
      selected_at: null,
    }, { onConflict: "event_id,vendor_id" });
    if (recErr) {
      // Fallback insert without upsert constraint name
      const { error: insErr } = await admin.from("event_vendor_recommendations").insert({
        venue_id: FANCY, event_id: event.id, vendor_id: HARAH,
        preference_level: "preferred", is_required: false,
        picked_at: new Date().toISOString(),
      });
      if (insErr) throw insErr;
    }

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    await page.goto(`${APP}/p/${token}#vendors`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await dismissWelcome(page);
    await page.waitForTimeout(1500);

    const submitList = page.getByRole("button", { name: /Submit Vendor List/i });
    const hasSubmit = await submitList.isVisible().catch(() => false);
    record("submit_bar_visible", hasSubmit, hasSubmit ? "Submit Vendor List shown" : await page.locator("body").innerText().then((t) => t.slice(0, 400)));
    if (!hasSubmit) {
      await page.screenshot({ path: `${OUT}/fail-no-submit-bar-1280.png`, fullPage: true }).catch(() => undefined);
      throw new Error("Submit Vendor List not visible");
    }
    await submitList.click();
    await page.waitForTimeout(500);

    const back = page.getByRole("button", { name: /^Back$/i });
    const submit = page.getByRole("button", { name: /Submit to Venue/i });
    record("confirm_panel", await back.isVisible() && await submit.isVisible(), "Back + Submit to Venue");

    async function measure(label: string) {
      const styles = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const backBtn = buttons.find((b) => /^Back$/i.test(b.textContent?.trim() ?? ""));
        const submitBtn = buttons.find((b) => /Submit to Venue/i.test(b.textContent ?? ""));
        const panel = backBtn?.closest("div.sticky, div.rounded-2xl") ?? backBtn?.parentElement?.parentElement;
        function sample(el: Element | null | undefined) {
          if (!el) return null;
          const s = getComputedStyle(el);
          return { color: s.color, bg: s.backgroundColor, border: s.borderTopColor };
        }
        return {
          panelBg: panel ? getComputedStyle(panel).backgroundColor : null,
          back: sample(backBtn),
          submit: sample(submitBtn),
          htmlClass: document.documentElement.className,
        };
      });
      const backRatio = styles.back
        ? contrast(styles.back.color, styles.back.bg, styles.panelBg ?? undefined)
        : null;
      const submitRatio = styles.submit
        ? contrast(styles.submit.color, styles.submit.bg, styles.panelBg ?? undefined)
        : null;
      record(
        `${label}_back_contrast`,
        (backRatio ?? 0) >= 4.5,
        `ratio=${backRatio?.toFixed(2)} color=${styles.back?.color} bg=${styles.back?.bg} panel=${styles.panelBg}`,
      );
      record(
        `${label}_submit_contrast`,
        (submitRatio ?? 0) >= 4.5,
        `ratio=${submitRatio?.toFixed(2)} color=${styles.submit?.color} bg=${styles.submit?.bg}`,
      );
      // Reject white-on-near-white / white-on-cream failure mode
      const backIsWhite = styles.back?.color === "rgb(255, 255, 255)" || styles.back?.color === "rgba(255, 255, 255, 1)";
      const backBgBright = (() => {
        const p = parseCssColor(styles.back?.bg ?? "");
        if (!p) return false;
        return luminance([p[0], p[1], p[2]]) > 0.7;
      })();
      record(`${label}_back_not_white_on_light`, !(backIsWhite && backBgBright), `white=${backIsWhite} brightBg=${backBgBright}`);
      return styles;
    }

    const desktop = await measure("desktop");
    await page.screenshot({ path: `${OUT}/confirm-1280.png` }).catch(() => undefined);

    // Hover + focus samples (desktop)
    await back.hover();
    await page.waitForTimeout(200);
    const hoverBack = await back.evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.color, bg: s.backgroundColor };
    });
    const hoverRatio = contrast(hoverBack.color, hoverBack.bg, desktop.panelBg ?? undefined);
    record("desktop_back_hover", (hoverRatio ?? 0) >= 4.5, `ratio=${hoverRatio?.toFixed(2)} ${JSON.stringify(hoverBack)}`);

    await back.focus();
    await page.waitForTimeout(100);
    record("desktop_back_focusable", await back.evaluate((el) => document.activeElement === el), "focus");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await measure("mobile");
    await page.screenshot({ path: `${OUT}/confirm-390.png` }).catch(() => undefined);

    // Surrounding flow: Pick button ink when present
    await back.click().catch(() => undefined);
    await page.waitForTimeout(300);
    const pickSample = await page.evaluate(() => {
      const pick = Array.from(document.querySelectorAll("button")).find((b) => /^(Pick|Select vendor)$/i.test(b.textContent?.trim() ?? ""));
      if (!pick) return null;
      const s = getComputedStyle(pick);
      return { color: s.color, bg: s.backgroundColor, text: pick.textContent?.trim() };
    });
    if (pickSample) {
      const ratio = contrast(pickSample.color, pickSample.bg);
      record("pick_button_contrast", (ratio ?? 0) >= 4.5, `ratio=${ratio?.toFixed(2)} ${JSON.stringify(pickSample)}`);
    } else {
      record("pick_button_contrast", true, "no unpicked Pick visible (all picked) — skipped");
    }

    await browser.close();
  } finally {
    await cleanup(email);
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ expectedSha: EXPECTED_SHA, passed, failed, checks }, null, 2));
  writeFileSync(`${OUT}/browser-run.log`, checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n"));
  console.log(`\n${failed === 0 ? "GREEN" : "NOT GREEN"} passed=${passed} failed=${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
