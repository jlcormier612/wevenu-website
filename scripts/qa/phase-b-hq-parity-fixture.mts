/**
 * Disposable Sandbox venue + disposable HQ admin for White-Glove extra-event parity.
 * Never touches Fancy / Willow Grove / Jennifer's shared login.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Refusing: not Sandbox supabase");
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const stamp = Date.now().toString(36);

async function seedLegal(userId: string) {
  const { data: docs, error } = await admin
    .from("legal_documents")
    .select("id, document_type, version")
    .eq("is_active", true)
    .eq("is_published", true)
    .in("document_type", [
      "terms_of_service",
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
      user_agent: "phase-b-hq-parity-acceptance",
    });
  }
}

async function createUser(email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser");
  await seedLegal(data.user.id);
  return data.user.id;
}

const venueEmail = `jennifer+byb.hqvenue.${stamp}@hellotocheers.com`;
const venuePassword = `BybV-${stamp}-Aa1x`;
const hqEmail = `jennifer+byb.hqadmin.${stamp}@hellotocheers.com`;
const hqPassword = `BybH-${stamp}-Aa1x`;

const venueUserId = await createUser(venueEmail, venuePassword);
const hqUserId = await createUser(hqEmail, hqPassword);

const { error: hqErr } = await admin.from("hq_admins").insert({
  user_id: hqUserId,
  role: "team",
  is_active: true,
});
if (hqErr) throw hqErr;

const { data: venue, error: venueErr } = await admin
  .from("venues")
  .insert({
    owner_user_id: venueUserId,
    name: `Phase B HQ Parity ${stamp}`,
    email: venueEmail,
    setup_completed: false,
    access_override_until: new Date(Date.now() + 14 * 86400000).toISOString(),
    access_override_reason: "phase_b_hq_parity_disposable",
  })
  .select("id,name")
  .single();
if (venueErr || !venue) throw venueErr ?? new Error("venue insert");
if (venue.id === FANCY || venue.id === WILLOW) throw new Error("refusing protected venue");

const { error: staffErr } = await admin.from("venue_staff").insert({
  venue_id: venue.id,
  user_id: venueUserId,
  full_name: "HQ Parity Venue Owner",
  email: venueEmail,
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
  user_id: venueUserId,
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

const { error: capErr } = await admin.from("venue_capacity_rules").insert({
  venue_id: venue.id,
  max_simultaneous_events: 2,
  min_turnaround_hours: 0,
});
if (capErr) console.log("CAPACITY_SKIP", capErr.message);

const { error: profileErr } = await admin.from("venue_setup_profiles").insert({
  venue_id: venue.id,
  name: "Standard Wedding Profile",
  decisions: { ceremony: true },
  template_refs: {},
});
if (profileErr) console.log("SETUP_PROFILE_SKIP", profileErr.message);

mkdirSync("/tmp/htc-byb-hq-parity-fixtures", { recursive: true });
writeFileSync(
  "/tmp/htc-byb-hq-parity-fixtures/upcoming.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past),Start Time (HH:MM),End Time (HH:MM)",
    "Dana,Booked,dana.booked@byb.test,2027-10-10,Wedding,85,Garden Room,booked,16:00,22:00",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-hq-parity-fixtures/second-event.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Dana,Booked,dana.booked@byb.test,2028-03-18,Wedding,60,Garden Room,booked",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-hq-parity-fixtures/retry.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Dana,Booked,dana.booked@byb.test,2027-10-10,Wedding,85,Garden Room,booked",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-hq-parity-fixtures/historical.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Owen,Past,owen.past@byb.test,2023-05-20,Wedding,110,Garden Room,past",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-hq-parity-fixtures/missing-date.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type",
    "Hold,Nodate,hold.nodate@byb.test,,Wedding",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-hq-parity-fixtures/bad-space.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Hold,Badspace,hold.badspace@byb.test,2027-11-11,Wedding,40,Ballroom That Does Not Exist,booked",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-hq-parity-fixtures/clash.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Clash,SameDay,clash.hq@byb.test,2027-10-10,Wedding,30,Garden Room,booked",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-hq-parity-fixtures/email-only.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Other,Office,dana.booked@byb.test,2028-08-08,Wedding,50,Garden Room,booked",
  ].join("\n"),
);

const creds = {
  venueEmail,
  venuePassword,
  venueUserId,
  hqEmail,
  hqPassword,
  hqUserId,
  venueId: venue.id,
  venueName: venue.name,
  spaceId: space.id,
  stamp,
};
writeFileSync("/tmp/htc-byb-hq-parity-creds.json", JSON.stringify(creds, null, 2));
console.log(JSON.stringify({
  ok: true,
  venueId: venue.id,
  venueName: venue.name,
  hqEmail,
  venueEmail,
}, null, 2));
