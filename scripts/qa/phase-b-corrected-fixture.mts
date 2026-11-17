/**
 * NEW disposable Sandbox venue for corrected Phase B browser acceptance.
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
const email = `jennifer+byb.corrected.${stamp}@hellotocheers.com`;
const password = `BybC-${stamp}-Aa1x`;

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
      user_agent: "phase-b-corrected-browser-acceptance",
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
    name: `Phase B Corrected ${stamp}`,
    email,
    setup_completed: false,
    access_override_until: new Date(Date.now() + 14 * 86400000).toISOString(),
    access_override_reason: "phase_b_corrected_browser_acceptance_disposable",
  })
  .select("id,name")
  .single();
if (venueErr || !venue) throw venueErr ?? new Error("venue insert");
if (PROTECTED.has(venue.id)) throw new Error("refusing protected venue");

const { error: staffErr } = await admin.from("venue_staff").insert({
  venue_id: venue.id,
  user_id: userId,
  full_name: "Phase B Corrected Owner",
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

mkdirSync("/tmp/htc-byb-corrected-fixtures", { recursive: true });
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/leads.csv",
  [
    "First Name,Last Name,Partner First Name,Partner Last Name,Email,Phone,Preferred Date (YYYY-MM-DD),Date Flexibility,Event Type,Guest Count,Source,Lead Status,Follow-up Date (YYYY-MM-DD),Next Action,Inquiry Notes",
    "Riley,Prospect,Sam,Prospect,riley.prospect@byb.test,555-0101,2027-06-12,Weekends in June,Wedding,120,Website,New Inquiry,2026-12-01,Send lookbook,Preferred June date — not booked",
    "Riley,Prospect,Sam,Prospect,riley.prospect@byb.test,555-0101,2028-05-03,Fall backup,Wedding,80,Website,Outreach Sent,2026-12-15,Follow up,Second inquiry different date",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/clients-upcoming.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past),Start Time (HH:MM),End Time (HH:MM)",
    "Bella,Upcoming,bella.upcoming@byb.test,2027-09-12,Wedding,90,Garden Room,booked,16:00,22:00",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/clients-past.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Mira,Historical,mira.historical@byb.test,2024-06-15,Wedding,100,Garden Room,past",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/clients-second-event.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Bella,Upcoming,bella.upcoming@byb.test,2028-04-04,Wedding,70,Garden Room,booked",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/clients-retry.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Bella,Upcoming,bella.upcoming@byb.test,2027-09-12,Wedding,90,Garden Room,booked",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/clients-missing-date.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type",
    "NoDate,Client,nodate.client@byb.test,,Wedding",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/clients-missing-space.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Booking Status (booked or past)",
    "NoSpace,Client,nospace.client@byb.test,2027-11-11,Wedding,60,booked",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/clients-bad-space.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "BadSpace,Client,badspace.client@byb.test,2027-12-12,Wedding,50,Ballroom That Does Not Exist,booked",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/clients-clash.csv",
  [
    "Partner 1 First Name,Partner 1 Last Name,Email,Event Date (YYYY-MM-DD),Event Type,Guest Count,Event Space Name,Booking Status (booked or past)",
    "Clash,SameDay,clash.sameday@byb.test,2027-09-12,Wedding,40,Garden Room,booked",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/leads-email-only.csv",
  [
    "First Name,Last Name,Email,Preferred Date (YYYY-MM-DD)",
    "Other,Person,riley.prospect@byb.test,2027-08-01",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/vendors.csv",
  [
    "Vendor name,Category,Email,Phone",
    "Bloom & Co Florals,Florist,bloom@byb.test,555-0199",
  ].join("\n"),
);
writeFileSync(
  "/tmp/htc-byb-corrected-fixtures/incomplete.csv",
  "Email,Phone\nmissing@byb.test,555-0000\n",
);

const creds = {
  email,
  password,
  userId,
  venueId: venue.id,
  venueName: venue.name,
  stamp,
  spaceId: space.id,
};

writeFileSync("/tmp/htc-byb-corrected-creds.json", JSON.stringify(creds, null, 2));
console.log(JSON.stringify({
  ok: true,
  email,
  venueId: venue.id,
  venueName: venue.name,
  spaceId: space.id,
}, null, 2));
