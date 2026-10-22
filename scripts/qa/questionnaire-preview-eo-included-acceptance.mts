/**
 * Sandbox: restore questionnaire preview appearance + nav; Event Order Overview Included.
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
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "REPLACE_AFTER_DEPLOY";
const OUT = "docs/qa/booking-to-portal-simplification";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 800) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 280)}`);
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

const KINDS = [
  { kind: "client_planning", slug: "client-planning" },
  { kind: "final_details", slug: "final-details" },
  { kind: "post_event_feedback", slug: "post-event" },
] as const;

async function main() {
  let servingSha: string | null = null;
  let eventId: string | null = null;
  let clientId: string | null = null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();

  try {
    const res = await page.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const link = res?.headers()["link"] ?? "";
    const html = await page.content();
    servingSha =
      link.match(/[0-9a-f]{40}/)?.[0]
      ?? html.match(/data-dpl-id="([a-f0-9]{40})"/)?.[1]
      ?? html.match(/dpl=([a-f0-9]{40})/)?.[1]
      ?? null;
    record(
      "serving_sha",
      !!servingSha && servingSha.startsWith(EXPECTED_SHA.slice(0, 8)),
      `serving=${servingSha} expected=${EXPECTED_SHA}`,
    );
    if (!servingSha?.startsWith(EXPECTED_SHA.slice(0, 8))) throw new Error("serving mismatch");

    const { count: invBefore } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY);

    const { data: events } = await admin
      .from("events")
      .select("id, client_id, event_setup_states!inner(uses_profile, collapsed_at)")
      .eq("venue_id", FANCY)
      .not("status", "in", '("cancelled","complete")')
      .order("event_date", { ascending: false })
      .limit(30);

    // Prefer non-collapsed Setup Profile events that already have an Event Order.
    for (const e of events ?? []) {
      const st = Array.isArray(e.event_setup_states) ? e.event_setup_states[0] : e.event_setup_states;
      if (!e.client_id || !st?.uses_profile || st?.collapsed_at) continue;
      const { count } = await admin
        .from("event_orders")
        .select("id", { count: "exact", head: true })
        .eq("event_id", e.id)
        .eq("venue_id", FANCY);
      if ((count ?? 0) > 0) {
        eventId = e.id;
        clientId = e.client_id;
        break;
      }
    }
    if (!eventId) {
      for (const e of events ?? []) {
        const st = Array.isArray(e.event_setup_states) ? e.event_setup_states[0] : e.event_setup_states;
        if (!e.client_id || !st?.uses_profile) continue;
        const { count } = await admin
          .from("event_orders")
          .select("id", { count: "exact", head: true })
          .eq("event_id", e.id)
          .eq("venue_id", FANCY);
        if ((count ?? 0) > 0) {
          eventId = e.id;
          clientId = e.client_id;
          break;
        }
      }
    }
    record("fixture", Boolean(eventId && clientId), `event=${eventId} client=${clientId}`);
    if (!eventId || !clientId) throw new Error("no fixture");

    // Snapshot questionnaires before preview
    const { data: qsBefore } = await admin
      .from("event_questionnaires")
      .select("id, kind, status, updated_at")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    const beforeMap = new Map((qsBefore ?? []).map((q) => [q.id, `${q.status}|${q.updated_at}`]));

    const { data: eoBefore } = await admin
      .from("event_orders")
      .select("id, status, shared_at, updated_at")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .maybeSingle();

    // — Event Order Included badge —
    await page.goto(`${APP}/clients/${clientId}#overview`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2500);
    await page.getByRole("tab", { name: /^Overview$/i }).click().catch(() => {});
    await page.waitForTimeout(800);
    for (const label of [/Review setup/i, /Reopen setup/i, /Show setup/i, /Expand/i]) {
      const btn = page.getByRole("button", { name: label });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(600);
      }
    }
    const eoCard = page.getByTestId("event-setup-card-event_order");
    await eoCard.scrollIntoViewIfNeeded().catch(() => {});
    const eoVisible = await eoCard.isVisible().catch(() => false);
    const eoBadge = eoVisible
      ? await eoCard.locator('[class*="badge"], [data-slot="badge"]').first().innerText().catch(async () => {
        const t = await eoCard.innerText();
        return t.match(/\b(Included|Draft|Needs action|Released|Not included)\b/)?.[1] ?? "";
      })
      : "";
    record(
      "event_order_badge_included",
      eoVisible && /^Included\b/i.test(String(eoBadge).trim()),
      eoVisible ? `badge=${String(eoBadge).trim()}` : `event order card missing body=${(await page.locator("body").innerText()).slice(0, 200)}`,
    );
    await page.screenshot({ path: `${OUT}/q-preview-eo-overview-1280.png`, fullPage: true });

    // — Three questionnaire previews —
    for (const { kind, slug } of KINDS) {
      await page.goto(
        `${APP}/events/${eventId}/questionnaire-preview?kind=${encodeURIComponent(kind)}&from=event`,
        { waitUntil: "domcontentloaded", timeout: 90_000 },
      );
      await page.waitForTimeout(1200);

      const nav = page.getByTestId("questionnaire-preview-nav");
      const backQ = page.getByTestId("questionnaire-preview-back");
      const backO = page.getByTestId("questionnaire-preview-back-overview");
      const body = await page.locator("form, main, body").first().innerText().catch(() => "");
      const hasPreviewMark = /Preview\s*[—\-]\s*not sent/i.test(await nav.innerText().catch(() => ""));
      const hasFormHeading = await page.locator("h1").first().isVisible().catch(() => false);
      const creamWrap = await page.locator('div.min-h-screen[class*="F7F5F1"], div[class*="bg-[#F7F5F1]"]').count().catch(() => 0);
      // Contrast: heading should not be near-white on cream — sample computed color
      const headingContrast = await page.locator("h1").first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return { color: cs.color, fontSize: cs.fontSize, display: cs.display };
      }).catch(() => null);
      const rgb = headingContrast?.color?.match(/\d+/g)?.map(Number) ?? [];
      const luminance = rgb.length >= 3
        ? (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
        : 0;
      // Washed-out failure mode was near-white text; require reasonably dark heading.
      const contrastOk = luminance < 0.55;

      record(
        `preview_${slug}_shell`,
        hasPreviewMark && hasFormHeading && creamWrap === 0 && contrastOk,
        `mark=${hasPreviewMark} h1=${hasFormHeading} cream=${creamWrap} luminance=${luminance.toFixed(3)} color=${headingContrast?.color ?? "?"}`,
      );
      await page.screenshot({ path: `${OUT}/q-preview-${slug}-1280.png`, fullPage: true });

      // Back to Overview (hard same-tab navigation)
      const overviewHref = await backO.getAttribute("href");
      await Promise.all([
        page.waitForURL((u) => u.href.includes(`/clients/${clientId}`), { timeout: 20_000 }),
        backO.click({ force: true }),
      ]).catch(async () => {
        if (overviewHref) await page.goto(new URL(overviewHref, APP).toString(), { waitUntil: "domcontentloaded" });
      });
      await page.waitForTimeout(800);
      record(
        `preview_${slug}_back_overview`,
        page.url().includes(`/clients/${clientId}`),
        `href=${overviewHref} url=${page.url()}`,
      );

      // Re-open preview and Back to Questionnaires
      await page.goto(
        `${APP}/events/${eventId}/questionnaire-preview?kind=${encodeURIComponent(kind)}&from=event`,
        { waitUntil: "domcontentloaded", timeout: 90_000 },
      );
      await page.waitForTimeout(800);
      const qHref = await page.getByTestId("questionnaire-preview-back").getAttribute("href");
      await Promise.all([
        page.waitForURL((u) => u.href.includes(`/clients/${clientId}`), { timeout: 20_000 }),
        page.getByTestId("questionnaire-preview-back").click({ force: true }),
      ]).catch(async () => {
        if (qHref) await page.goto(new URL(qHref, APP).toString(), { waitUntil: "domcontentloaded" });
      });
      await page.waitForTimeout(800);
      record(
        `preview_${slug}_back_questionnaires`,
        page.url().includes(`/clients/${clientId}`) && (page.url().includes("questionnaires") || Boolean(qHref?.includes("questionnaires"))),
        `href=${qHref} url=${page.url()}`,
      );
    }

    const { data: qsAfter } = await admin
      .from("event_questionnaires")
      .select("id, kind, status, updated_at")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    const unchanged = (qsAfter ?? []).every((q) => beforeMap.get(q.id) === `${q.status}|${q.updated_at}`);
    record("questionnaire_persistence_unchanged", unchanged && (qsAfter?.length ?? 0) === beforeMap.size, `before=${beforeMap.size} after=${qsAfter?.length ?? 0}`);

    const { data: eoAfter } = await admin
      .from("event_orders")
      .select("id, status, shared_at, updated_at")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .maybeSingle();
    record(
      "event_order_state_unchanged",
      eoBefore?.status === eoAfter?.status
        && eoBefore?.shared_at === eoAfter?.shared_at
        && eoBefore?.updated_at === eoAfter?.updated_at,
      `before=${eoBefore?.status}/${eoBefore?.shared_at} after=${eoAfter?.status}/${eoAfter?.shared_at}`,
    );

    const { count: invAfter } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY);
    record("no_invoice_side_effect", invBefore === invAfter, `before=${invBefore} after=${invAfter}`);
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err));
    await page.screenshot({ path: `${OUT}/q-preview-eo-harness-error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const failed = checks.filter((c) => !c.pass).length;
  const passed = checks.filter((c) => c.pass).length;
  const payload = {
    status: failed === 0 ? "GREEN" : "NOT_GREEN",
    servingSha,
    expectedSha: EXPECTED_SHA,
    eventId,
    clientId,
    passed,
    failed,
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/q-preview-eo-included-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ status: payload.status, passed, failed, servingSha }, null, 2));
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
