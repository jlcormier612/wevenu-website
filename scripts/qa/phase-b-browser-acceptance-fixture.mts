/**
 * Disposable Sandbox venue for Phase B browser acceptance.
 * Never touches Fancy / Willow Grove / Jennifer's shared login.
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const PROTECTED = new Set([FANCY, WILLOW]);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Refusing: not Sandbox supabase");
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const stamp = Date.now().toString(36);
const email = `jennifer+byb.phaseb.${stamp}@hellotocheers.com`;
const password = `Byb-${stamp}-Aa1x`;

function personPayload(input: {
  firstName: string;
  lastName: string;
  email: string;
  partnerFirstName?: string;
  partnerLastName?: string;
  partnerEmail?: string;
  eventDate?: string;
  eventType?: string;
}) {
  return {
    leadId: null,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: "",
    partnerFirstName: input.partnerFirstName ?? "",
    partnerLastName: input.partnerLastName ?? "",
    partnerEmail: input.partnerEmail ?? "",
    eventType: input.eventType ?? "",
    eventDate: input.eventDate ?? "",
    endDate: "",
    guestCount: "",
    ceremonyTime: "",
    receptionTime: "",
    rehearsalDate: "",
    internalNotes: "phase-b-fixture",
    isHistoricalImport: true,
  };
}

async function seedLegal(userId: string) {
  const { data: docs, error } = await admin
    .from("legal_documents")
    .select("id, document_type, version")
    .eq("is_active", true)
    .eq("is_published", true)
    .in("document_type", [
      "venue_terms_of_service",
      "privacy_policy",
      "acceptable_use_policy",
      "cookie_policy",
    ]);
  if (error) throw error;
  const now = new Date().toISOString();
  for (const doc of docs ?? []) {
    await admin.from("legal_acceptances").insert({
      user_id: userId,
      legal_document_id: doc.id,
      accepted_version: doc.version,
      accepted_at: now,
      acceptance_method: "Venue Signup",
      ip_address: "127.0.0.1",
      user_agent: "phase-b-browser-acceptance",
    });
  }
}

const { data: userData, error: userErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (userErr || !userData.user) throw userErr ?? new Error("createUser");
const userId = userData.user.id;
await seedLegal(userId);

const { data: venue, error: venueErr } = await admin
  .from("venues")
  .insert({
    owner_user_id: userId,
    name: `Phase B Disposable ${stamp}`,
    email,
    setup_completed: false,
    access_override_until: new Date(Date.now() + 14 * 86400000).toISOString(),
    access_override_reason: "phase_b_browser_acceptance_disposable",
  })
  .select("id,name")
  .single();
if (venueErr || !venue) throw venueErr ?? new Error("venue insert");
if (PROTECTED.has(venue.id)) throw new Error("refusing protected venue");

const { error: staffErr } = await admin.from("venue_staff").insert({
  venue_id: venue.id,
  user_id: userId,
  full_name: "Phase B Owner",
  email,
  role: "owner",
  is_owner: true,
  is_active: true,
  accepted_at: new Date().toISOString(),
  access_title: "administrator",
  title_basis: "administrator",
  capability_overrides: {},
  owner_invite_pending: false,
});
if (staffErr) throw staffErr;

const { error: ctxErr } = await admin.from("venue_staff_active_context").upsert({
  user_id: userId,
  active_venue_id: venue.id,
  updated_at: new Date().toISOString(),
});
if (ctxErr) throw ctxErr;

const { data: space, error: spaceErr } = await admin
  .from("venue_spaces")
  .insert({
    venue_id: venue.id,
    name: "Garden Room",
    description: "Disposable test space",
    capacity: 80,
    is_active: true,
    permitted_uses: ["ceremony", "reception"],
  })
  .select("id")
  .single();
if (spaceErr || !space) throw spaceErr ?? new Error("space insert");

const { error: profileErr } = await admin.from("venue_setup_profiles").insert({
  venue_id: venue.id,
  name: "Standard Wedding Profile",
  decisions: { ceremony: true },
  template_refs: {},
});
if (profileErr) {
  console.log("SETUP_PROFILE_SKIP", profileErr.message);
}

async function createClientAtomic(input: Parameters<typeof personPayload>[0]) {
  const { data, error } = await admin.rpc("create_client_atomic", {
    payload: personPayload(input),
    p_venue_id_override: venue.id,
  });
  if (error) throw error;
  return data as string;
}

const exactId = await createClientAtomic({
  firstName: "Nora",
  lastName: "Exact",
  email: "nora.exact@byb.test",
});
const likelyId = await createClientAtomic({
  firstName: "Priya",
  lastName: "Likely",
  email: "priya.likely@byb.test",
});
const distinctExistingId = await createClientAtomic({
  firstName: "Avery",
  lastName: "Chen",
  email: "shared.office@byb.test",
});

const { data: historical, error: histErr } = await admin.rpc(
  "create_client_and_event_with_availability",
  {
    payload: personPayload({
      firstName: "Mira",
      lastName: "Past",
      email: "mira.past@byb.test",
      eventDate: "2024-06-15",
      eventType: "wedding",
    }),
    p_event: {
      name: "Mira Past — wedding",
      eventType: "wedding",
      eventDate: "2024-06-15",
      eventEndDate: "",
      startTime: "",
      endTime: "",
      setupTime: "",
      teardownTime: "",
      guestCount: "",
      spaceId: space.id,
      status: "complete",
    },
    p_venue_id_override: venue.id,
  },
);
if (histErr) throw histErr;
if (!historical || historical.ok !== true) {
  throw new Error("historical RPC unexpected: " + JSON.stringify(historical));
}

const bookedClientId = await createClientAtomic({
  firstName: "Bella",
  lastName: "Booked",
  email: "bella.booked@byb.test",
  eventDate: "2027-09-12",
  eventType: "wedding",
});
const { data: booked, error: bookErr } = await admin.rpc("book_relationship", {
  p_venue_id: venue.id,
  p_client_id: bookedClientId,
  p_space_id: space.id,
  p_pipeline_stage_id: null,
  p_name: "Bella Booked — wedding",
  p_event_type: "wedding",
  p_event_date: "2027-09-12",
  p_event_end_date: null,
  p_start_time: null,
  p_end_time: null,
  p_setup_time: null,
  p_teardown_time: null,
  p_guest_count: null,
  p_lifecycle_origin: "import",
  p_confirmed_occupancy: null,
});
if (bookErr) throw bookErr;

const { data: histSetup } = await admin
  .from("event_setup_states")
  .select("event_id")
  .eq("venue_id", venue.id)
  .eq("event_id", historical.event_id);
const { data: bookedSetup } = await admin
  .from("event_setup_states")
  .select("event_id")
  .eq("venue_id", venue.id)
  .eq("event_id", booked?.event_id ?? "none");

const creds = {
  email,
  password,
  userId,
  venueId: venue.id,
  venueName: venue.name,
  stamp,
  spaceId: space.id,
  seeded: {
    exactClientId: exactId,
    likelyClientId: likelyId,
    distinctExistingId,
    historicalClientId: historical.client_id,
    historicalEventId: historical.event_id,
    bookedClientId,
    bookedEventId: booked?.event_id ?? null,
    historicalHasSetupState: (histSetup ?? []).length > 0,
    bookedHasSetupState: (bookedSetup ?? []).length > 0,
  },
};

writeFileSync("/tmp/htc-byb-phase-b-creds.json", JSON.stringify(creds, null, 2));
console.log(JSON.stringify({
  ok: true,
  email,
  venueId: venue.id,
  venueName: venue.name,
  seeded: creds.seeded,
  bookedRpcOk: booked?.ok === true,
}, null, 2));
