/**
 * Sandbox: Edit event (unrelated field) must not wipe component schedule.
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
const OUT_DIR = "docs/qa/edit-event-preserves-schedule";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "";

function weekendPair(): { fri: string; sat: string } {
  const base = new Date(Date.UTC(2033, 2, 4)); // Sat
  const weeks = Math.floor(Date.now() / 60000) % 400;
  base.setUTCDate(base.getUTCDate() + weeks * 7);
  const sat = base.toISOString().slice(0, 10);
  const friDate = new Date(base);
  friDate.setUTCDate(friDate.getUTCDate() - 1);
  return { fri: friDate.toISOString().slice(0, 10), sat };
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
  before?: unknown;
  afterSetup?: unknown;
  afterGuests?: unknown;
} = { ok: true, servingSha: null, checks: [], ids: {} };

function record(name: string, pass: boolean, detail: string) {
  out.checks.push({ name, pass, detail });
  if (!pass) out.ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(link: string | undefined | null): string | null {
  if (!link) return null;
  const m = link.match(/dpl=([0-9a-f]{40})/i);
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

async function loadAssignments(eventId: string) {
  const { data } = await admin
    .from("event_space_assignments")
    .select("id, use_key, space_id, scheduled_date, start_time, end_time, sort_order")
    .eq("event_id", eventId)
    .order("sort_order");
  return data ?? [];
}

function scheduleFingerprint(rows: Array<{
  use_key: string;
  space_id: string;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
}>) {
  return rows
    .map((r) =>
      [
        r.use_key,
        r.space_id,
        r.scheduled_date,
        String(r.start_time ?? "").slice(0, 5),
        String(r.end_time ?? "").slice(0, 5),
      ].join("|"),
    )
    .sort()
    .join(";");
}

async function seed() {
  const stamp = Date.now();
  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: VENUE,
      first_name: "EditSched",
      last_name: `Proof${stamp}`,
      email: `edit-sched-${stamp}@hellotocheers-test.invalid`,
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
      first_name: "EditSched",
      last_name: `Proof${stamp}`,
      email: `edit-sched-${stamp}@hellotocheers-test.invalid`,
      status: "confirmed",
      event_date: FRI,
      end_date: SAT,
      event_type: "wedding",
    })
    .select("id")
    .single();
  if (clientErr || !client) throw clientErr ?? new Error(clientErr?.message);

  const { data: event, error: eventErr } = await admin
    .from("events")
    .insert({
      venue_id: VENUE,
      client_id: client.id,
      name: `EditSched Proof ${stamp}`,
      event_date: FRI,
      event_end_date: SAT,
      event_type: "wedding",
      space_id: SPACE.barn,
      booked_at: new Date().toISOString(),
      status: "confirmed",
      guest_count: 100,
      setup_time: "14:00",
      teardown_time: "23:00",
    })
    .select("id")
    .single();
  if (eventErr || !event) throw eventErr ?? new Error(eventErr?.message);

  const { error: assignErr } = await admin.from("event_space_assignments").insert(
    COMPONENTS.map((c) => ({
      venue_id: VENUE,
      event_id: event.id,
      ...c,
    })),
  );
  if (assignErr) throw assignErr;

  return {
    leadId: lead.id as string,
    clientId: client.id as string,
    eventId: event.id as string,
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

async function editUnrelatedField(
  page: import("playwright").Page,
  eventId: string,
  field: "setup" | "guests",
  value: string,
) {
  await page.goto(`${APP}/events/${eventId}/edit`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  if (field === "setup") {
    await page.locator("#su").fill(value);
  } else {
    await page.locator("#gc").fill(value);
  }
  await page.getByRole("button", { name: /Save changes/i }).click();
  await page.waitForURL(new RegExp(`/events/${eventId}`), { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(800);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const seeded = await seed();
  out.ids = { ...seeded };

  const before = await loadAssignments(seeded.eventId);
  out.before = before;
  const beforeFp = scheduleFingerprint(before);
  record(
    "seeded_five_components",
    before.length === 5 && before.every((r) => r.scheduled_date && r.start_time),
    beforeFp,
  );

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
    const tipOk = !EXPECTED_PREFIX
      || (!!out.servingSha && out.servingSha.startsWith(EXPECTED_PREFIX));
    record("serving_commit", tipOk, out.servingSha ?? "no dpl");
    if (!tipOk) throw new Error(`serving ${out.servingSha}`);

    await editUnrelatedField(page, seeded.eventId, "setup", "13:30");
    const afterSetup = await loadAssignments(seeded.eventId);
    out.afterSetup = afterSetup;
    const setupFp = scheduleFingerprint(afterSetup);
    record(
      "setup_edit_preserves_schedule",
      setupFp === beforeFp && afterSetup.length === 5,
      `before=${beforeFp}\nafter=${setupFp}`,
    );

    const { data: eventAfterSetup } = await admin
      .from("events")
      .select("setup_time, guest_count")
      .eq("id", seeded.eventId)
      .maybeSingle();
    record(
      "setup_time_saved",
      String(eventAfterSetup?.setup_time ?? "").startsWith("13:30"),
      JSON.stringify(eventAfterSetup),
    );

    await editUnrelatedField(page, seeded.eventId, "guests", "142");
    const afterGuests = await loadAssignments(seeded.eventId);
    out.afterGuests = afterGuests;
    const guestsFp = scheduleFingerprint(afterGuests);
    record(
      "guest_edit_preserves_schedule",
      guestsFp === beforeFp && afterGuests.length === 5,
      `fp=${guestsFp}`,
    );

    await page.goto(`${APP}/clients/${seeded.clientId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    const body = await page.locator("body").innerText();
    record(
      "schedule_card_not_time_not_set",
      !body.includes("Time not set")
        && body.includes("Rehearsal Dinner")
        && body.includes("Ceremony"),
      "schedule card shows components without Time not set",
    );
    await page.screenshot({
      path: `${OUT_DIR}/after-edit-event.png`,
      fullPage: true,
    });

    // Explicit Edit schedule still works — change cocktail end only
    await page.getByTestId("edit-booking-schedule").click();
    await page.getByTestId("esa-date-cocktail_hour").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("#esa-cocktail_hour-end").fill("18:30");
    await page.getByRole("button", { name: /Save schedule|Save/i }).click();
    await page.waitForTimeout(1500);
    const afterScheduleEdit = await loadAssignments(seeded.eventId);
    const cocktail = afterScheduleEdit.find((r) => r.use_key === "cocktail_hour");
    const ceremony = afterScheduleEdit.find((r) => r.use_key === "ceremony");
    record(
      "explicit_schedule_edit_works",
      String(cocktail?.end_time ?? "").startsWith("18:30")
        && String(ceremony?.start_time ?? "").startsWith("18:00")
        && ceremony?.scheduled_date === SAT,
      JSON.stringify({ cocktail, ceremony }),
    );
  } finally {
    await browser.close();
    writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(out, null, 2));
    console.log(`Wrote ${OUT_DIR}/browser-results.json ok=${out.ok}`);
    if (out.ok) {
      await cleanup(seeded);
      console.log("Cleaned disposable fixture");
    } else {
      console.log("Kept fixture:", seeded);
    }
  }

  if (!out.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
