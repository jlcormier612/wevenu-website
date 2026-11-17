/**
 * NEW disposable Sandbox venues for Phase B.3 Client/Event + Vendor review.
 * Never touches Fancy / Willow Grove / Jennifer's shared login.
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
      user_agent: "phase_b3_unified_review_acceptance",
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
      access_override_reason: "phase_b3_unified_review_disposable",
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

  const { data: spaces, error: spaceErr } = await admin
    .from("venue_spaces")
    .insert([
      {
        venue_id: venue.id,
        name: "Garden Room",
        description: "Disposable test space",
        capacity: 80,
        is_active: true,
        permitted_uses: ["ceremony", "reception"],
      },
      {
        venue_id: venue.id,
        name: "Ballroom",
        description: "Second disposable space for same-date Events",
        capacity: 40,
        is_active: true,
        permitted_uses: ["ceremony", "reception"],
      },
    ])
    .select("id,name");
  if (spaceErr || !spaces?.length) throw spaceErr ?? new Error("space insert");

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

  return { venue, spaces };
}

const ssEmail = `jennifer+byb.b3ss.${stamp}@hellotocheers.com`;
const ssPassword = `BybS-${stamp}-Aa1x`;
const hqVenueEmail = `jennifer+byb.b3hqv.${stamp}@hellotocheers.com`;
const hqVenuePassword = `BybV-${stamp}-Aa1x`;
const hqEmail = `jennifer+byb.b3hqa.${stamp}@hellotocheers.com`;
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

const ss = await createVenue({ email: ssEmail, userId: ssUserId, name: `Phase B.3 SS ${stamp}` });
const hq = await createVenue({ email: hqVenueEmail, userId: hqVenueUserId, name: `Phase B.3 HQ ${stamp}` });

const dir = "/tmp/htc-byb-b3-unified-review-fixtures";
mkdirSync(dir, { recursive: true });

writeFileSync(
  `${dir}/clients-morgan.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past),Start Time (HH:MM),End Time (HH:MM),Source client ID,Source event ID,Internal notes",
    "Morgan,Booked,morgan.booked@byb.test,2027-09-12,Wedding,90,Garden Room,booked,16:00,22:00,CLI-1,EVT-1,Original booking",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-additional.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past),Start Time (HH:MM),End Time (HH:MM),Source client ID,Source event ID,Internal notes",
    "Morgan,Booked,morgan.booked@byb.test,2028-02-02,Wedding,80,Garden Room,booked,17:00,22:00,CLI-1,EVT-2,Second booked event",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-same-date.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past),Start Time (HH:MM),End Time (HH:MM),Source client ID,Source event ID,Internal notes",
    "Morgan,Booked,morgan.booked@byb.test,2027-09-12,Rehearsal dinner,40,Ballroom,booked,18:00,21:00,CLI-1,EVT-3,Same-date additional event",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-same-file.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past),Start Time (HH:MM),End Time (HH:MM)",
    "Jordan,File,jordan.file@byb.test,2027-10-10,Wedding,70,Garden Room,booked,16:00,22:00",
    "Jordan,File,jordan.file@byb.test,2028-03-04,Wedding,65,Garden Room,booked,16:00,22:00",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-email-only.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past),Start Time (HH:MM),End Time (HH:MM)",
    "Other,Office,morgan.booked@byb.test,2027-08-01,Wedding,50,Garden Room,booked,15:00,21:00",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-changed.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past),Start Time (HH:MM),End Time (HH:MM),Source client ID,Source event ID,Internal notes",
    "Morgan,Booked,morgan.booked@byb.test,2027-09-12,Wedding,120,Garden Room,booked,16:00,22:00,CLI-1,EVT-1,Updated guests — do not overwrite",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-missing-date.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Type,Guest Count",
    "Pat,Nodate,pat.nodate@byb.test,Wedding,40",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-dont-import.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Dana,Skip,dana.skip@byb.test,2027-11-11,Wedding,60,Garden Room,booked",
  ].join("\n"),
);
writeFileSync(
  `${dir}/clients-held.csv`,
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Morgan,Booked,morgan.booked@byb.test,2029-04-18,Wedding,88,Garden Room,booked",
    "Casey,Clear,casey.clear@byb.test,2027-12-12,Wedding,55,Garden Room,booked",
  ].join("\n"),
);
writeFileSync(
  `${dir}/vendors-first.csv`,
  [
    "Vendor name,Category,Contact name,Email,Phone,Website URL,Notes,Source vendor ID",
    "Bloom & Co,Florist,Avery Bloom,hello@bloom.test,555-0200,https://bloom.test,Original florist notes,V-1",
  ].join("\n"),
);
writeFileSync(
  `${dir}/vendors-same-email.csv`,
  [
    "Vendor name,Category,Contact name,Email,Phone,Website URL,Notes",
    "Bloom Catering,Catering,Blair Bloom,hello@bloom.test,555-0201,https://bloomcatering.test,Same email different business",
  ].join("\n"),
);
writeFileSync(
  `${dir}/vendors-same-name.csv`,
  [
    "Vendor name,Category,Contact name,Email,Phone,Website URL,Notes",
    "Bloom & Co,Florist,Avery Bloom,office@bloom.test,555-0200,https://bloom.test,Same business different email",
  ].join("\n"),
);
writeFileSync(
  `${dir}/vendors-changed.csv`,
  [
    "Vendor name,Category,Contact name,Email,Phone,Website URL,Notes,Source vendor ID",
    "Bloom & Co,Florist,Updated Contact,hello@bloom.test,555-0299,https://bloom.test,Changed details — do not overwrite,V-1",
  ].join("\n"),
);
writeFileSync(
  `${dir}/vendors-dont-import.csv`,
  [
    "Vendor name,Category,Email",
    "Skip Vendor,Other,skip.vendor@byb.test",
  ].join("\n"),
);

const creds = {
  ssEmail,
  ssPassword,
  ssUserId,
  ssVenueId: ss.venue.id,
  ssVenueName: ss.venue.name,
  hqVenueEmail,
  hqVenuePassword,
  hqVenueUserId,
  hqVenueId: hq.venue.id,
  hqVenueName: hq.venue.name,
  hqEmail,
  hqPassword,
  hqUserId,
  stamp,
};
writeFileSync("/tmp/htc-byb-b3-unified-review-creds.json", JSON.stringify(creds, null, 2));
console.log(JSON.stringify({
  ok: true,
  ssVenueId: ss.venue.id,
  ssVenueName: ss.venue.name,
  hqVenueId: hq.venue.id,
  hqVenueName: hq.venue.name,
  hqEmail,
  ssEmail,
}, null, 2));
