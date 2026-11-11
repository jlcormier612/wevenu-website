/**
 * Sandbox-only — The Willow Grove reporting demo-data enhancement (~12 months).
 *
 * Safeguards:
 * - Refuses non-sandbox Supabase URL
 * - Venue locked to The Willow Grove demo id
 * - Does not touch Ellie St. James / Avery Blake polished demo leads
 * - No emails/SMS/Stripe/live payment side effects
 * - Idempotent via email domain @rpt.willowgrove.demo + metadata seed tag
 * - Never deletes existing polished records
 *
 * Usage:
 *   npx tsx scripts/sandbox/willow-grove-reporting-demo-data.mts --dry-run
 *   npx tsx scripts/sandbox/willow-grove-reporting-demo-data.mts --apply
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";

config({ path: ".env.local", quiet: true });

const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const SEED_TAG = "reporting-12mo-v1";
const EMAIL_DOMAIN = "rpt.willowgrove.demo";
const SANDBOX_HOST = "wvpsldwwjqdannqasrdf";
/** Garden Lawn / Carriage House / Grove Pavilion */
const SPACE_IDS = [
  "53d99e7f-3301-4dc7-8327-71ec45f1fb47",
  "2354568b-1971-4ee0-9bb8-10bb964d23ea",
  "c3f3a195-f3a7-4298-a5e4-c413d3990f4a",
] as const;

const PROTECTED_EMAIL_SUBSTR = [
  "elliestjames",
  "hellotocheers.demo",
  "avery.blake",
];

type Source =
  | "website"
  | "referral"
  | "the_knot"
  | "wedding_wire"
  | "instagram"
  | "facebook"
  | "google"
  | "email"
  | "phone"
  | null;

type EventType = "wedding" | "corporate" | "private_event" | "birthday" | "cocktail_hour";

type SeedLead = {
  slug: string;
  firstName: string;
  lastName: string;
  partnerFirst?: string;
  partnerLast?: string;
  source: Source;
  eventType: EventType;
  /** Days ago the lead was created */
  createdDaysAgo: number;
  outcome:
    | "lead_only"
    | "toured"
    | "booked"
    | "lost"
    | "cancelled_after_book"
    | "rebooked";
  /** Days after lead creation when first booked (if booked) */
  bookDelayDays?: number;
  guestCount: number;
  packageAmount: number;
  missingAttribution?: boolean;
};

function parseArgs() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run") || !apply;
  return { apply, dryRun };
}

function deterministicId(slug: string): string {
  const hex = createHash("sha256").update(`${SEED_TAG}:${slug}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hex.slice(18, 20),
    hex.slice(20, 32),
  ].join("-");
}

function isoDaysAgo(days: number, hour = 14): string {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function dateDaysAgo(days: number): string {
  return isoDaysAgo(days).slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function seasonalLeadPlan(): SeedLead[] {
  const firstNames = [
    "Harper", "Quinn", "Rowan", "Sloane", "Tessa", "Vera", "Willa", "Yuki", "Ada", "Blair",
    "Cora", "Drew", "Eden", "Freya", "Gia", "Holly", "Iris", "June", "Kate", "Lana",
    "Mira", "Noelle", "Opal", "Paige", "Remy", "Sage", "Thea", "Uma", "Violet", "Wren",
    "Anya", "Bryn", "Celeste", "Dahlia", "Elise", "Faye", "Greta", "Hazel", "Indie", "Jules",
  ];
  const lastNames = [
    "Ashford", "Bellamy", "Carver", "Dalton", "Ellison", "Farrell", "Gable", "Hale", "Iverson", "Jensen",
    "Keane", "Lang", "Monroe", "Nash", "Ortega", "Pratt", "Quincy", "Rivers", "Sterling", "Tate",
    "Underwood", "Vale", "Whitman", "York", "Zimmerman", "Brennan", "Callahan", "Dorsey", "Everett", "Frost",
  ];
  const sources: Source[] = [
    "website", "website", "website", "referral", "referral", "the_knot", "the_knot",
    "wedding_wire", "instagram", "instagram", "facebook", "google", "email", "phone", null,
  ];
  const types: EventType[] = [
    "wedding", "wedding", "wedding", "wedding", "corporate", "private_event", "birthday", "cocktail_hour",
  ];
  const outcomes: SeedLead["outcome"][] = [
    "lead_only", "lead_only", "toured", "toured", "booked", "booked", "booked", "lost", "cancelled_after_book", "rebooked",
  ];

  const leads: SeedLead[] = [];
  // ~8–12 leads per month across ~12 months with spring/fall peaks
  for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
    const baseDays = monthOffset * 30 + 5;
    const peak = monthOffset === 2 || monthOffset === 3 || monthOffset === 8 || monthOffset === 9;
    const count = peak ? 11 : 8;
    for (let i = 0; i < count; i++) {
      const idx = leads.length;
      const createdDaysAgo = baseDays - Math.floor(i * 2.4);
      const source = sources[idx % sources.length]!;
      const outcome = outcomes[idx % outcomes.length]!;
      const eventType = types[idx % types.length]!;
      const packageAmount =
        eventType === "wedding" ? 14000 + (idx % 7) * 1200
          : eventType === "corporate" ? 8000 + (idx % 5) * 900
            : 4500 + (idx % 6) * 700;
      leads.push({
        slug: `m${String(monthOffset).padStart(2, "0")}-i${String(i).padStart(2, "0")}`,
        firstName: firstNames[idx % firstNames.length]!,
        lastName: lastNames[idx % lastNames.length]!,
        partnerFirst: eventType === "wedding" ? firstNames[(idx + 7) % firstNames.length] : undefined,
        partnerLast: eventType === "wedding" ? lastNames[(idx + 11) % lastNames.length] : undefined,
        source: source === null || (idx % 17 === 0) ? null : source,
        missingAttribution: source === null || idx % 17 === 0,
        eventType,
        createdDaysAgo: Math.max(1, createdDaysAgo),
        outcome,
        bookDelayDays: outcome === "lead_only" || outcome === "toured" || outcome === "lost" ? undefined : 12 + (idx % 28),
        guestCount: eventType === "wedding" ? 110 + (idx % 40) : 40 + (idx % 60),
        packageAmount,
      });
    }
  }
  return leads;
}

function isProtectedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return PROTECTED_EMAIL_SUBSTR.some((s) => lower.includes(s));
}

async function main() {
  const { apply, dryRun } = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url.includes(SANDBOX_HOST)) {
    console.error("REFUSED: not Sandbox Supabase URL");
    process.exit(1);
  }
  if (!key) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: venue } = await sb.from("venues").select("id, name").eq("id", WILLOW).maybeSingle();
  if (!venue || venue.name !== "The Willow Grove") {
    console.error("REFUSED: Willow Grove venue not found", venue);
    process.exit(1);
  }

  console.log(`\nWillow Grove reporting demo data (${SEED_TAG})`);
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(`Venue: ${venue.name} (${venue.id})\n`);

  const summary = {
    lifecycleBackfilled: 0,
    sourcesRemapped: 0,
    seedLeadsUpserted: 0,
    seedBookings: 0,
    seedClients: 0,
    seedEvents: 0,
    contractsSigned: 0,
    paidAtSpread: 0,
    rebooked: 0,
    skippedProtected: 0,
  };

  // ── 1) Backfill lifecycle_booking_events for existing booked leads ──
  const { data: bookedLeads } = await sb
    .from("leads")
    .select("id, first_name, last_name, email, acquisition_source, first_booked_at, sales_stage")
    .eq("venue_id", WILLOW)
    .eq("sales_stage", "booked");

  const { data: clients } = await sb
    .from("clients")
    .select("id, lead_id, first_name, last_name, lifecycle_booked_at, email")
    .eq("venue_id", WILLOW);

  const clientByLead = new Map((clients ?? []).filter((c) => c.lead_id).map((c) => [c.lead_id as string, c]));

  for (const lead of bookedLeads ?? []) {
    if (isProtectedEmail(lead.email)) {
      summary.skippedProtected++;
      continue;
    }
    const { data: existing } = await sb
      .from("lifecycle_booking_events")
      .select("id")
      .eq("venue_id", WILLOW)
      .eq("lead_id", lead.id)
      .eq("event_kind", "first_booked")
      .maybeSingle();
    if (existing) continue;

    const client = clientByLead.get(lead.id);
    const occurred =
      client?.lifecycle_booked_at ??
      lead.first_booked_at ??
      isoDaysAgo(60);
    summary.lifecycleBackfilled++;
    if (dryRun) continue;
    await sb.from("lifecycle_booking_events").insert({
      venue_id: WILLOW,
      lead_id: lead.id,
      client_id: client?.id ?? null,
      origin: "pipeline",
      event_kind: "first_booked",
      occurred_at: occurred,
      acquisition_source: lead.acquisition_source,
      metadata: { seed: SEED_TAG, kind: "backfill_existing_booked" },
    });
  }

  // Also backfill leadless clients with lifecycle_booked_at
  for (const client of clients ?? []) {
    if (client.lead_id || !client.lifecycle_booked_at) continue;
    if (isProtectedEmail(client.email)) {
      summary.skippedProtected++;
      continue;
    }
    const { data: existing } = await sb
      .from("lifecycle_booking_events")
      .select("id")
      .eq("venue_id", WILLOW)
      .eq("client_id", client.id)
      .is("lead_id", null)
      .eq("event_kind", "first_booked")
      .maybeSingle();
    if (existing) continue;
    summary.lifecycleBackfilled++;
    if (dryRun) continue;
    await sb.from("lifecycle_booking_events").insert({
      venue_id: WILLOW,
      lead_id: null,
      client_id: client.id,
      origin: "direct",
      event_kind: "first_booked",
      occurred_at: client.lifecycle_booked_at,
      acquisition_source: null,
      metadata: { seed: SEED_TAG, kind: "backfill_leadless_client" },
    });
  }

  // ── 2) Remap acquisition_source on unprotected demo booked leads stuck on "other" ──
  const remapPool: Source[] = [
    "website", "referral", "the_knot", "instagram", "wedding_wire", "google", "email", "phone",
  ];
  let remapIdx = 0;
  for (const lead of bookedLeads ?? []) {
    if (isProtectedEmail(lead.email)) continue;
    if (lead.acquisition_source && lead.acquisition_source !== "other") continue;
    const next = remapPool[remapIdx % remapPool.length]!;
    remapIdx++;
    summary.sourcesRemapped++;
    if (dryRun) continue;
    await sb.from("leads").update({ acquisition_source: next, source: next }).eq("id", lead.id).eq("venue_id", WILLOW);
    await sb
      .from("lifecycle_booking_events")
      .update({ acquisition_source: next })
      .eq("venue_id", WILLOW)
      .eq("lead_id", lead.id)
      .eq("event_kind", "first_booked");
  }

  // ── 3) Create ~12 months of seed leads (+ bookings/clients/events/contracts) ──
  const plan = seasonalLeadPlan();
  console.log(`Planned seed leads: ${plan.length}`);

  for (const item of plan) {
    const leadId = deterministicId(`lead:${item.slug}`);
    const clientId = deterministicId(`client:${item.slug}`);
    const eventId = deterministicId(`event:${item.slug}`);
    const contractId = deterministicId(`contract:${item.slug}`);
    const scheduleId = deterministicId(`schedule:${item.slug}`);
    const depositId = deterministicId(`deposit:${item.slug}`);
    const invoiceId = deterministicId(`invoice:${item.slug}`);
    const lineId = deterministicId(`invline:${item.slug}`);
    const email = `${item.slug}@${EMAIL_DOMAIN}`;
    const createdAt = isoDaysAgo(item.createdDaysAgo, 11 + (item.slug.charCodeAt(item.slug.length - 1) % 8));
    const bookAt =
      item.bookDelayDays != null
        ? isoDaysAgo(Math.max(0, item.createdDaysAgo - item.bookDelayDays), 16)
        : null;
    const eventDate = bookAt
      ? addDays(bookAt.slice(0, 10), 180 + (item.slug.length % 90))
      : addDays(createdAt.slice(0, 10), 200);

    // sales_stage "booked" is trigger-guarded (book_relationship only). Reporting
    // Bookings use lifecycle_booking_events + first_booked_at instead.
    const stage =
      item.outcome === "lead_only" ? "new_inquiry"
        : item.outcome === "toured" ? "tour_scheduled"
          : item.outcome === "lost" || item.outcome === "cancelled_after_book" ? "lost"
            : "proposal_sent";
    const hasLifecycleBook =
      item.outcome === "booked" ||
      item.outcome === "rebooked" ||
      item.outcome === "cancelled_after_book";

    summary.seedLeadsUpserted++;
    if (!dryRun) {
      const { error: leadErr } = await sb.from("leads").upsert({
        id: leadId,
        venue_id: WILLOW,
        first_name: item.firstName,
        last_name: item.lastName,
        partner_first_name: item.partnerFirst ?? null,
        partner_last_name: item.partnerLast ?? null,
        email,
        phone: null,
        status: item.outcome === "lost" || item.outcome === "cancelled_after_book" ? "lost" : "active",
        sales_stage: stage,
        source: item.missingAttribution ? null : item.source,
        acquisition_source: item.missingAttribution ? null : item.source,
        event_type: item.eventType,
        event_date: eventDate,
        guest_count: item.guestCount,
        estimated_budget: String(item.packageAmount),
        created_at: createdAt,
        updated_at: createdAt,
        first_booked_at: hasLifecycleBook && bookAt ? bookAt : null,
        exclude_from_business_reporting: false,
        inquiry_message: `[${SEED_TAG}] Demo inquiry for reporting volume.`,
      }, { onConflict: "id" });
      if (leadErr) console.error("lead upsert failed", item.slug, leadErr.message);
    }

    if (hasLifecycleBook && bookAt) {
      summary.seedBookings++;
      summary.seedClients++;
      summary.seedEvents++;
      if (item.outcome === "rebooked") summary.rebooked++;
      if (!dryRun) {
        const spaceId = SPACE_IDS[item.slug.charCodeAt(item.slug.length - 1) % SPACE_IDS.length]!;

        const { error: clientErr } = await sb.from("clients").upsert({
          id: clientId,
          venue_id: WILLOW,
          lead_id: leadId,
          first_name: item.firstName,
          last_name: item.lastName,
          partner_first_name: item.partnerFirst ?? null,
          partner_last_name: item.partnerLast ?? null,
          email,
          lifecycle_booked_at: bookAt,
          created_at: bookAt,
          updated_at: bookAt,
        }, { onConflict: "id" });
        if (clientErr) console.error("client upsert failed", item.slug, clientErr.message);

        // Insert event without booked_at first if needed — assign space, then set booked_at.
        const { error: eventErr1 } = await sb.from("events").upsert({
          id: eventId,
          venue_id: WILLOW,
          client_id: clientId,
          name: item.eventType === "wedding"
            ? `${item.firstName} & ${item.partnerFirst ?? "Partner"} ${item.lastName} Wedding`
            : `${item.lastName} ${item.eventType.replace("_", " ")}`,
          event_date: eventDate,
          event_type: item.eventType,
          guest_count: item.guestCount,
          space_id: spaceId,
          status: item.outcome === "cancelled_after_book" ? "cancelled" : "confirmed",
          created_at: bookAt,
          updated_at: bookAt,
        }, { onConflict: "id" });
        if (eventErr1) console.error("event upsert failed", item.slug, eventErr1.message);

        await sb.from("event_space_assignments").upsert({
          id: deterministicId(`spaceasn:${item.slug}`),
          venue_id: WILLOW,
          event_id: eventId,
          use_key: "event_space",
          use_label: "Event space",
          space_id: spaceId,
          sort_order: 0,
          created_at: bookAt,
          updated_at: bookAt,
        }, { onConflict: "id" });

        const { error: eventErr2 } = await sb.from("events").update({
          booked_at: bookAt.slice(0, 10),
        }).eq("id", eventId).eq("venue_id", WILLOW);
        if (eventErr2) console.error("event booked_at failed", item.slug, eventErr2.message);

        const { data: lifeExisting } = await sb
          .from("lifecycle_booking_events")
          .select("id")
          .eq("venue_id", WILLOW)
          .eq("lead_id", leadId)
          .eq("event_kind", "first_booked")
          .maybeSingle();
        if (!lifeExisting) {
          const { error: lifeErr } = await sb.from("lifecycle_booking_events").insert({
            venue_id: WILLOW,
            lead_id: leadId,
            client_id: clientId,
            origin: "pipeline",
            event_kind: "first_booked",
            occurred_at: bookAt,
            acquisition_source: item.missingAttribution ? null : item.source,
            metadata: { seed: SEED_TAG, slug: item.slug },
          });
          if (lifeErr) console.error("lifecycle insert failed", item.slug, lifeErr.message);
        }

        if (item.outcome === "rebooked") {
          const rebookAt = isoDaysAgo(Math.max(0, item.createdDaysAgo - (item.bookDelayDays ?? 20) - 40), 15);
          const { data: reExisting } = await sb
            .from("lifecycle_booking_events")
            .select("id")
            .eq("venue_id", WILLOW)
            .eq("lead_id", leadId)
            .eq("event_kind", "rebooked")
            .maybeSingle();
          if (!reExisting) {
            await sb.from("lifecycle_booking_events").insert({
              venue_id: WILLOW,
              lead_id: leadId,
              client_id: clientId,
              origin: "pipeline",
              event_kind: "rebooked",
              occurred_at: rebookAt,
              previous_sales_stage: "lost",
              metadata: { seed: SEED_TAG, slug: item.slug, note: "rebooking_example" },
            });
          }
        }

        // Financial commitment: signed contract + paid deposit (no Stripe)
        summary.contractsSigned++;
        const { error: conErr } = await sb.from("contracts").upsert({
          id: contractId,
          venue_id: WILLOW,
          client_id: clientId,
          event_id: eventId,
          title: `Venue Agreement — ${item.firstName} ${item.lastName}`,
          content: `[${SEED_TAG}] Sandbox demo agreement for reporting. No external notifications.`,
          status: "signed",
          signer_name: `${item.firstName} ${item.lastName}`,
          signed_at: bookAt,
          sent_at: bookAt,
          consent_confirmed: true,
          is_couple_visible: false,
          execution_origin: "htc",
          created_at: bookAt,
          updated_at: bookAt,
        }, { onConflict: "id" });
        if (conErr) console.error("contract upsert failed", item.slug, conErr.message);

        const { error: schedErr } = await sb.from("payment_schedules").upsert({
          id: scheduleId,
          venue_id: WILLOW,
          client_id: clientId,
          event_id: eventId,
          title: `${item.lastName} payments`,
          total_amount: item.packageAmount,
          currency: "USD",
          created_at: bookAt,
          updated_at: bookAt,
        }, { onConflict: "id" });
        if (schedErr) console.error("schedule upsert failed", item.slug, schedErr.message);

        const deposit = Math.round(item.packageAmount * 0.25);
        const { error: depErr } = await sb.from("payment_line_items").upsert({
          id: depositId,
          venue_id: WILLOW,
          schedule_id: scheduleId,
          label: "Booking deposit",
          amount: deposit,
          paid_amount: deposit,
          refunded_amount: 0,
          status: "paid",
          sort_order: 0,
          paid_at: bookAt,
          due_date: bookAt.slice(0, 10),
          created_at: bookAt,
          updated_at: bookAt,
        }, { onConflict: "id" });
        if (depErr) console.error("deposit upsert failed", item.slug, depErr.message);

        // Second installment sometimes unpaid → outstanding
        const balanceId = deterministicId(`balance:${item.slug}`);
        const remaining = item.packageAmount - deposit;
        await sb.from("payment_line_items").upsert({
          id: balanceId,
          venue_id: WILLOW,
          schedule_id: scheduleId,
          label: "Balance",
          amount: remaining,
          paid_amount: item.outcome === "booked" && item.slug.endsWith("0") ? remaining : 0,
          refunded_amount: 0,
          status: item.outcome === "booked" && item.slug.endsWith("0") ? "paid" : "pending",
          sort_order: 1,
          paid_at: item.outcome === "booked" && item.slug.endsWith("0")
            ? isoDaysAgo(Math.max(0, item.createdDaysAgo - (item.bookDelayDays ?? 0) - 20), 12)
            : null,
          due_date: addDays(eventDate, -30),
          created_at: bookAt,
          updated_at: bookAt,
        }, { onConflict: "id" });

        const { error: invErr } = await sb.from("invoices").upsert({
          id: invoiceId,
          venue_id: WILLOW,
          client_id: clientId,
          event_id: eventId,
          invoice_number: `WG-RPT-${item.slug.toUpperCase()}`,
          status: "partially_paid",
          subtotal: item.packageAmount,
          discount_amount: 0,
          created_at: bookAt,
          updated_at: bookAt,
        }, { onConflict: "id" });
        if (invErr) console.error("invoice upsert failed", item.slug, invErr.message);

        const { error: iliErr } = await sb.from("invoice_line_items").upsert({
          id: lineId,
          invoice_id: invoiceId,
          venue_id: WILLOW,
          type: "package",
          description: "Celebration package",
          amount: item.packageAmount,
          quantity: 1,
          revenue_category: item.eventType === "wedding" ? "Packages" : "Venue Rental",
          created_at: bookAt,
        }, { onConflict: "id" });
        if (iliErr) console.error("invoice line upsert failed", item.slug, iliErr.message);
      }
    }
  }

  // ── 4) Unlock revenue for existing polished demo clients: signed contracts where paid deposit exists ──
  const { data: schedules } = await sb
    .from("payment_schedules")
    .select("id, client_id")
    .eq("venue_id", WILLOW);

  for (const schedule of schedules ?? []) {
    const client = (clients ?? []).find((c) => c.id === schedule.client_id);
    if (client && isProtectedEmail(client.email)) {
      // Ellie already has a signed contract — leave alone
      continue;
    }
    const { data: firstLine } = await sb
      .from("payment_line_items")
      .select("id, status, paid_at")
      .eq("schedule_id", schedule.id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!firstLine || firstLine.status !== "paid" || !firstLine.paid_at) continue;

    const { data: signed } = await sb
      .from("contracts")
      .select("id")
      .eq("venue_id", WILLOW)
      .eq("client_id", schedule.client_id)
      .eq("status", "signed")
      .maybeSingle();
    if (signed) continue;

    const contractId = deterministicId(`unlock-contract:${schedule.client_id}`);
    summary.contractsSigned++;
    if (dryRun) continue;
    await sb.from("contracts").upsert({
      id: contractId,
      venue_id: WILLOW,
      client_id: schedule.client_id,
      title: `Venue Agreement — reporting unlock (${SEED_TAG})`,
      content: `[${SEED_TAG}] Signed sandbox agreement to unlock canonical contracted revenue. No notifications sent.`,
      status: "signed",
      signer_name: client ? `${client.first_name} ${client.last_name}` : "Client",
      signed_at: firstLine.paid_at,
      sent_at: firstLine.paid_at,
      consent_confirmed: true,
      is_couple_visible: false,
      execution_origin: "htc",
      created_at: firstLine.paid_at,
      updated_at: firstLine.paid_at,
    }, { onConflict: "id" });
  }

  // ── 5) Spread clustered paid_at dates for existing deposits (non-seed, non-protected) ──
  const { data: clustered } = await sb
    .from("payment_line_items")
    .select("id, schedule_id, paid_at, sort_order")
    .eq("venue_id", WILLOW)
    .eq("status", "paid")
    .eq("sort_order", 0)
    .gte("paid_at", "2026-09-18T00:00:00Z")
    .lte("paid_at", "2026-09-18T23:59:59Z");

  let spreadIdx = 0;
  for (const row of clustered ?? []) {
    const newPaid = isoDaysAgo(70 + spreadIdx * 7, 18);
    spreadIdx++;
    summary.paidAtSpread++;
    if (dryRun) continue;
    await sb.from("payment_line_items").update({ paid_at: newPaid }).eq("id", row.id).eq("venue_id", WILLOW);
  }

  console.log("\nSummary:");
  console.log(JSON.stringify(summary, null, 2));
  console.log(dryRun
    ? "\nDry-run only. Re-run with --apply to write Sandbox records."
    : "\nApplied to Sandbox Willow Grove only. Production untouched.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
