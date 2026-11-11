/**
 * Sandbox proof for tax/discount Overview + Contract Builder copy,
 * and booked component schedule → timeline sync.
 * Disposable Meadowbrook records only. Production untouched.
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
const STAFF_EMAIL = "jlcormier612@gmail.com";
const VENUE = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const SPACE = {
  barn: "6366187b-e7f5-45d0-b9bd-5534a48f6650",
  villa: "e11e9e2f-1930-464d-b9e7-d0c61c30b221",
  bridge: "696791d8-0e6f-4a6c-b99e-031ee7237d38",
  lawn: "56a70756-5ee3-4e08-8e1b-d1713c5bbbec",
};
const OUT_DIR = "docs/qa/tax-discount-schedule-timeline";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "fd2c01a2";

/** Unique far-future Fri/Sat weekend to avoid Sandbox occupancy collisions. */
function weekendPair(): { fri: string; sat: string } {
  const base = new Date(Date.UTC(2032, 0, 2)); // Sat
  const weeks = Math.floor(Date.now() / 60000) % 400;
  base.setUTCDate(base.getUTCDate() + weeks * 7);
  const satDate = base;
  const friDate = new Date(base);
  friDate.setUTCDate(friDate.getUTCDate() - 1);
  return {
    fri: friDate.toISOString().slice(0, 10),
    sat: satDate.toISOString().slice(0, 10),
  };
}
const { fri: FRI, sat: SAT } = weekendPair();

const COMPONENTS = [
  {
    use_key: "rehearsal_dinner",
    use_label: "Rehearsal Dinner",
    space_id: SPACE.barn,
    scheduled_date: FRI,
    start_time: "18:00",
    end_time: "21:00",
    sort_order: 0,
  },
  {
    use_key: "getting_ready",
    use_label: "Getting Ready",
    space_id: SPACE.villa,
    scheduled_date: SAT,
    start_time: "14:00",
    end_time: "16:00",
    sort_order: 1,
  },
  {
    use_key: "ceremony",
    use_label: "Ceremony",
    space_id: SPACE.bridge,
    scheduled_date: SAT,
    start_time: "18:00",
    end_time: "22:00",
    sort_order: 2,
  },
  {
    use_key: "reception",
    use_label: "Reception",
    space_id: SPACE.barn,
    scheduled_date: SAT,
    start_time: "16:00",
    end_time: "17:00",
    sort_order: 3,
  },
  {
    use_key: "cocktail_hour",
    use_label: "Cocktail Hour",
    space_id: SPACE.lawn,
    scheduled_date: SAT,
    start_time: "17:00",
    end_time: "18:00",
    sort_order: 4,
  },
] as const;

const out: {
  ok: boolean;
  servingSha: string | null;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  ids: Record<string, string | null>;
  timelineBeforeReload?: unknown;
  timelineAfterReload?: unknown;
} = { ok: true, servingSha: null, checks: [], ids: {} };

function record(name: string, pass: boolean, detail: string) {
  out.checks.push({ name, pass, detail });
  if (!pass) out.ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(htmlOrLink: string | undefined | null): string | null {
  if (!htmlOrLink) return null;
  const m = htmlOrLink.match(/dpl=([0-9a-f]{40})/i);
  return m?.[1] ?? null;
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

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
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return ssrUtils.createChunks(cookieName, encoded).map(
    (c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    }),
  );
}

async function loadGenerated(eventId: string) {
  const { data, error } = await admin
    .from("timeline_entries")
    .select(
      "id, title, entry_time, end_time, day_offset, source_space_use_key, description, lock_state",
    )
    .eq("event_id", eventId)
    .not("source_space_use_key", "is", null)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

async function seed() {
  const stamp = Date.now();
  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: VENUE,
      first_name: "SchedTl",
      last_name: `Proof${stamp}`,
      email: `sched-tl-${stamp}@hellotocheers-test.invalid`,
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
      event_type: "wedding",
      event_date: FRI,
      end_date: SAT,
    })
    .select("id")
    .single();
  if (leadErr || !lead) throw leadErr ?? new Error("lead");

  const { data: client, error: clientErr } = await admin
    .from("clients")
    .insert({
      venue_id: VENUE,
      lead_id: lead.id,
      first_name: "SchedTl",
      last_name: `Proof${stamp}`,
      email: `sched-tl-${stamp}@hellotocheers-test.invalid`,
      status: "confirmed",
      event_date: FRI,
      end_date: SAT,
      event_type: "wedding",
    })
    .select("id")
    .single();
  if (clientErr || !client) throw clientErr ?? new Error(`client: ${clientErr?.message}`);

  const { data: event, error: eventErr } = await admin
    .from("events")
    .insert({
      venue_id: VENUE,
      client_id: client.id,
      name: `SchedTl Proof ${stamp}`,
      event_date: FRI,
      event_end_date: SAT,
      event_type: "wedding",
      space_id: SPACE.barn,
      booked_at: new Date().toISOString(),
      status: "confirmed",
      guest_count: 120,
    })
    .select("id")
    .single();
  if (eventErr || !event) throw eventErr ?? new Error("event");

  const { error: assignErr } = await admin.from("event_space_assignments").insert(
    COMPONENTS.map((c) => ({
      venue_id: VENUE,
      event_id: event.id,
      ...c,
    })),
  );
  if (assignErr) throw assignErr;

  const { data: manual, error: manualErr } = await admin
    .from("timeline_entries")
    .insert({
      venue_id: VENUE,
      event_id: event.id,
      title: "Manual venue note — do not touch",
      description: "Unrelated manual timeline entry",
      entry_time: "09:00",
      day_offset: 0,
      sort_order: 99,
      owner: "venue",
      lock_state: "editable",
      status: "not_started",
      audiences: ["client"],
      source_space_use_key: null,
    })
    .select("id")
    .single();
  if (manualErr || !manual) throw manualErr ?? new Error("manual");

  return {
    leadId: lead.id as string,
    clientId: client.id as string,
    eventId: event.id as string,
    manualId: manual.id as string,
  };
}

async function cleanup(ids: {
  leadId?: string | null;
  clientId?: string | null;
  eventId?: string | null;
}) {
  if (ids.eventId) {
    await admin.from("timeline_entries").delete().eq("event_id", ids.eventId);
    await admin.from("event_space_assignments").delete().eq("event_id", ids.eventId);
    await admin.from("events").delete().eq("id", ids.eventId);
  }
  if (ids.clientId) await admin.from("clients").delete().eq("id", ids.clientId);
  if (ids.leadId) await admin.from("leads").delete().eq("id", ids.leadId);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const { error: colErr } = await admin
    .from("timeline_entries")
    .select("source_space_use_key")
    .limit(1);
  record(
    "migration_source_space_use_key",
    !colErr,
    colErr ? colErr.message : "column selectable",
  );
  if (colErr) throw new Error(`migration missing: ${colErr.message}`);

  const seeded = await seed();
  out.ids = { ...seeded };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(STAFF_EMAIL));
  await context.addCookies([
    {
      name: "htc_active_venue_id",
      value: VENUE,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      secure: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();

  try {
    const login = await page.goto(APP + "/login", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    out.servingSha = noteDeployment(login?.headers()["link"]);
    const tipOk =
      !!out.servingSha && out.servingSha.startsWith(EXPECTED_PREFIX);
    record("serving_commit", tipOk, out.servingSha ?? "no dpl");
    if (!tipOk) {
      throw new Error(
        `serving ${out.servingSha}, expected prefix ${EXPECTED_PREFIX}`,
      );
    }

    // A2 — Contract Builder guidance (outside editable body)
    await page.goto(`${APP}/contracts/new?clientId=${seeded.clientId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    const guidance = page.getByTestId("contract-builder-agreement-guidance");
    await guidance.waitFor({ state: "visible", timeout: 30_000 });
    const guidanceText = await guidance.innerText();
    record(
      "a2_contract_builder_guidance",
      guidanceText.includes("Your agreement, your venue's terms")
        && guidanceText.includes("not legal or tax advice"),
      guidanceText.slice(0, 180),
    );
    const contentVal = await page.locator("#cb-content").inputValue().catch(() => "");
    record(
      "a2_not_in_contract_body",
      !contentVal.includes("Your agreement, your venue's terms"),
      `content length=${contentVal.length}`,
    );
    await page.screenshot({
      path: `${OUT_DIR}/contract-builder-guidance.png`,
      fullPage: true,
    });

    // A3/A4 — lead Overview responsibility notes
    await page.goto(`${APP}/leads/${seeded.leadId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.getByTestId("booking-details-rows").waitFor({
      state: "visible",
      timeout: 30_000,
    }).catch(() => undefined);
    const leadBody = await page.locator("body").innerText();
    record(
      "a1_selected_package_locked_hint_absent",
      !leadBody.includes(
        "Tax and discount for this Selected Package were set under Tax",
      ),
      "locked Selected Package paragraph absent",
    );
    const contractNote = page.getByTestId("contract-responsibility-note");
    const invoiceNote = page.getByTestId("invoice-payment-plan-responsibility-note");
    const hasContractNote = (await contractNote.count()) > 0;
    const hasInvoiceNote = (await invoiceNote.count()) > 0;
    record(
      "a3_contract_overview_note",
      hasContractNote
        && (await contractNote.innerText()).includes(
          "You are responsible for your agreement's terms and policies",
        ),
      hasContractNote
        ? (await contractNote.innerText()).slice(0, 160)
        : "missing (Booking Details Contract row may be gated)",
    );
    record(
      "a4_invoice_overview_note",
      hasInvoiceNote
        && (await invoiceNote.innerText()).includes(
          "Leads & Booking",
        )
        && (await invoiceNote.innerText()).includes("Invoice Adjustments"),
      hasInvoiceNote
        ? (await invoiceNote.innerText()).slice(0, 200)
        : "missing (Payment Plan row may be gated)",
    );
    await page.screenshot({
      path: `${OUT_DIR}/lead-overview-copy.png`,
      fullPage: true,
    });

    // Also check client Overview commercial facts when present
    await page.goto(`${APP}/clients/${seeded.clientId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    const clientBody = await page.locator("body").innerText();
    if ((await page.getByTestId("invoice-payment-plan-responsibility-note").count()) > 0) {
      const t = await page.getByTestId("invoice-payment-plan-responsibility-note").innerText();
      record("a4_client_overview_note", t.includes("Invoice Adjustments"), t.slice(0, 200));
    } else if ((await page.getByTestId("contract-responsibility-note").count()) > 0) {
      record("a3_client_overview_note", true, "contract note on client overview");
    } else {
      record(
        "overview_notes_on_client_or_lead",
        hasContractNote || hasInvoiceNote || clientBody.includes("You are responsible"),
        "at least one Overview note path rendered",
      );
    }

    // B — open client/event workspace so getTimelineEntries syncs
    await page.goto(`${APP}/clients/${seeded.clientId}`, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    await page.getByRole("tab", { name: /Timeline/i }).click().catch(() => undefined);
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${OUT_DIR}/timeline-after-sync.png`,
      fullPage: true,
    });

    const generated = await loadGenerated(seeded.eventId);
    out.timelineBeforeReload = generated;
    const byKey = Object.fromEntries(
      generated.map((g) => [g.source_space_use_key, g]),
    );
    record(
      "b_five_generated_activities",
      generated.length === 5,
      `count=${generated.length} keys=${generated.map((g) => g.source_space_use_key).join(",")}`,
    );
    record(
      "b_rehearsal_fri_times",
      byKey.rehearsal_dinner?.day_offset === 0
        && String(byKey.rehearsal_dinner?.entry_time).startsWith("18:00")
        && String(byKey.rehearsal_dinner?.end_time).startsWith("21:00")
        && (byKey.rehearsal_dinner?.description ?? "").includes("Meadowbrook Barn"),
      JSON.stringify(byKey.rehearsal_dinner ?? null),
    );
    record(
      "b_ceremony_unusual_times_preserved",
      byKey.ceremony?.day_offset === 1
        && String(byKey.ceremony?.entry_time).startsWith("18:00")
        && String(byKey.ceremony?.end_time).startsWith("22:00"),
      JSON.stringify(byKey.ceremony ?? null),
    );
    record(
      "b_reception_before_ceremony_preserved",
      byKey.reception?.day_offset === 1
        && String(byKey.reception?.entry_time).startsWith("16:00")
        && String(byKey.reception?.end_time).startsWith("17:00"),
      JSON.stringify(byKey.reception ?? null),
    );

    const { data: manualStill } = await admin
      .from("timeline_entries")
      .select("id, title, source_space_use_key")
      .eq("id", seeded.manualId)
      .maybeSingle();
    record(
      "b_manual_entry_preserved",
      !!manualStill
        && manualStill.title === "Manual venue note — do not touch"
        && manualStill.source_space_use_key == null,
      JSON.stringify(manualStill),
    );

    // Reload — idempotent
    await page.reload({ waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(1000);
    const after = await loadGenerated(seeded.eventId);
    out.timelineAfterReload = after;
    record(
      "b_no_duplicates_after_reload",
      after.length === 5
        && new Set(after.map((a) => a.source_space_use_key)).size === 5,
      `count=${after.length}`,
    );

    const timelineText = await page.locator("body").innerText();
    record(
      "b_ui_shows_component_names",
      ["Rehearsal Dinner", "Ceremony", "Reception", "Cocktail Hour", "Getting Ready"].every(
        (n) => timelineText.includes(n),
      ),
      "component titles visible after sync",
    );
  } finally {
    await browser.close();
    writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(out, null, 2));
    console.log(`Wrote ${OUT_DIR}/browser-results.json ok=${out.ok}`);
    // Keep disposable fixture for inspection if failed; clean when green.
    if (out.ok) {
      await cleanup(seeded);
      console.log("Cleaned disposable fixture");
    } else {
      console.log("Kept fixture for inspection:", seeded);
    }
  }

  if (!out.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
