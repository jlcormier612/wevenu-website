/**
 * NEW disposable Sandbox venues for Corrected Phase B.2 Lead parity.
 * One venue for self-service, one for HQ White-Glove. Never touches Fancy /
 * Willow Grove / Jennifer's shared login.
 */
import { mkdirSync, writeFileSync } from "node:fs";
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
      user_agent: "phase_b2_lead_parity_acceptance",
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

async function createVenue(opts: { email: string; userId: string; name: string }) {
  const { data: venue, error: venueErr } = await admin
    .from("venues")
    .insert({
      owner_user_id: opts.userId,
      name: opts.name,
      email: opts.email,
      setup_completed: false,
      access_override_until: new Date(Date.now() + 14 * 86400000).toISOString(),
      access_override_reason: "phase_b2_lead_parity_disposable",
    })
    .select("id,name")
    .single();
  if (venueErr || !venue) throw venueErr ?? new Error("venue insert");
  if (PROTECTED.has(venue.id)) throw new Error("refusing protected venue");

  const { error: staffErr } = await admin.from("venue_staff").insert({
    venue_id: venue.id,
    user_id: opts.userId,
    full_name: `${opts.name} Owner`,
    email: opts.email,
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
    user_id: opts.userId,
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

  return { venue, spaceId: space.id };
}

const ssEmail = `jennifer+byb.b2ss.${stamp}@hellotocheers.com`;
const ssPassword = `BybS-${stamp}-Aa1x`;
const hqVenueEmail = `jennifer+byb.b2hqv.${stamp}@hellotocheers.com`;
const hqVenuePassword = `BybV-${stamp}-Aa1x`;
const hqEmail = `jennifer+byb.b2hqa.${stamp}@hellotocheers.com`;
const hqPassword = `BybH-${stamp}-Aa1x`;

const ssUserId = await createUser(ssEmail, ssPassword);
const hqVenueUserId = await createUser(hqVenueEmail, hqVenuePassword);
const hqUserId = await createUser(hqEmail, hqPassword);

const { error: hqErr } = await admin.from("hq_admins").insert({
  user_id: hqUserId,
  role: "team",
  is_active: true,
});
if (hqErr) throw hqErr;

const ss = await createVenue({ email: ssEmail, userId: ssUserId, name: `Phase B.2 SS ${stamp}` });
const hq = await createVenue({ email: hqVenueEmail, userId: hqVenueUserId, name: `Phase B.2 HQ ${stamp}` });

const dir = "/tmp/htc-byb-b2-lead-parity-fixtures";
mkdirSync(dir, { recursive: true });

writeFileSync(
  `${dir}/leads-riley.csv`,
  [
    "First Name,Last Name,Partner First Name,Partner Last Name,Email,Phone,Preferred Date (YYYY-MM-DD),Date Flexibility,Event Type,Guest Count,Source,Lead Status,Follow-up Date (YYYY-MM-DD),Next Action,Inquiry Notes",
    "Riley,Prospect,Sam,Prospect,riley.prospect@byb.test,555-0101,2027-06-12,Weekends in June,Wedding,120,Website,New Inquiry,2026-12-01,Send lookbook,Preferred June date — not booked",
    "Riley,Prospect,Sam,Prospect,riley.prospect@byb.test,555-0101,2028-05-03,Fall backup,Wedding,80,Website,Outreach Sent,2026-12-15,Follow up,Second inquiry different date",
  ].join("\n"),
);
writeFileSync(
  `${dir}/leads-email-only.csv`,
  [
    "First Name,Last Name,Email,Preferred Date (YYYY-MM-DD)",
    "Other,Office,riley.prospect@byb.test,2027-08-01",
  ].join("\n"),
);
writeFileSync(
  `${dir}/leads-blank.csv`,
  [
    "First Name,Last Name,Email,Source,Inquiry Notes,Event Type,Guest Count",
    "Riley,Prospect,riley.prospect@byb.test,Website,Weekday phone call — no date yet,Wedding,90",
    "Riley,Prospect,riley.prospect@byb.test,The Knot,Bridal show follow-up — no date yet,Wedding,75",
    "Riley,Prospect,riley.prospect@byb.test,Website,Weekday phone call — no date yet,Wedding,90",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-morgan.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past),Start Time (HH:MM),End Time (HH:MM)",
    "Morgan,Booked,morgan.booked@byb.test,2027-09-12,Wedding,90,Garden Room,booked,16:00,22:00",
  ].join("\n"),
);
writeFileSync(
  `${dir}/leads-morgan-inquiry.csv`,
  [
    "First Name,Last Name,Email,Preferred Date (YYYY-MM-DD),Event Type,Inquiry Notes",
    "Morgan,Booked,morgan.booked@byb.test,2028-02-02,Wedding,Unbooked second inquiry after the existing booking",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-bella.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past),Start Time (HH:MM),End Time (HH:MM)",
    "Bella,Upcoming,bella.upcoming@byb.test,2027-10-10,Wedding,85,Garden Room,booked,16:00,22:00",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-bella-second.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Bella,Upcoming,bella.upcoming@byb.test,2028-03-18,Wedding,60,Garden Room,booked",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-bella-retry.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Bella,Upcoming,bella.upcoming@byb.test,2027-10-10,Wedding,85,Garden Room,booked",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-mira.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Mira,Historical,mira.historical@byb.test,2024-06-15,Wedding,100,Garden Room,past",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-hold.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type",
    "Hold,Nodate,hold.nodate@byb.test,,Wedding",
  ].join("\n"),
);

const creds = {
  ssEmail,
  ssPassword,
  ssUserId,
  ssVenueId: ss.venue.id,
  ssVenueName: ss.venue.name,
  ssSpaceId: ss.spaceId,
  hqVenueEmail,
  hqVenuePassword,
  hqVenueUserId,
  hqVenueId: hq.venue.id,
  hqVenueName: hq.venue.name,
  hqSpaceId: hq.spaceId,
  hqEmail,
  hqPassword,
  hqUserId,
  stamp,
};
writeFileSync("/tmp/htc-byb-b2-lead-parity-creds.json", JSON.stringify(creds, null, 2));
console.log(JSON.stringify({
  ok: true,
  ssVenueId: ss.venue.id,
  ssVenueName: ss.venue.name,
  hqVenueId: hq.venue.id,
  hqVenueName: hq.venue.name,
  hqEmail,
  ssEmail,
}, null, 2));
