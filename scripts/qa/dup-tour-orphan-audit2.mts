import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";

config({ path: ".env.local", quiet: true });

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/duplicate-lead-tour-orphan";
mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const { data: archived, error: aErr } = await admin
  .from("tour_appointments")
  .select(
    "id,lead_id,status,scheduled_at,duration_minutes,contact_email,contact_name,confirm_token,confirmed_at,confirmation_source,is_archived,created_at,origin",
  )
  .eq("venue_id", FANCY)
  .eq("is_archived", true)
  .in("status", ["scheduled", "confirmed"])
  .order("scheduled_at", { ascending: false })
  .limit(50);
if (aErr) console.error("archived err", aErr);

const { data: nullLead, error: nErr } = await admin
  .from("tour_appointments")
  .select(
    "id,lead_id,status,scheduled_at,duration_minutes,contact_email,contact_name,confirm_token,confirmed_at,confirmation_source,is_archived,created_at,origin",
  )
  .eq("venue_id", FANCY)
  .is("lead_id", null)
  .in("status", ["scheduled", "confirmed"])
  .order("scheduled_at", { ascending: false })
  .limit(50);
if (nErr) console.error("nullLead err", nErr);

const { data: reviews } = await admin
  .from("lead_duplicate_reviews")
  .select("*")
  .eq("venue_id", FANCY)
  .order("created_at", { ascending: false })
  .limit(10);

const reviewDetails = [];
for (const r of reviews ?? []) {
  const { data: lead } = await admin
    .from("leads")
    .select("id,email,first_name,last_name")
    .eq("id", r.lead_id)
    .maybeSingle();
  const { data: matched } = r.matched_lead_id
    ? await admin
        .from("leads")
        .select("id,email,first_name,last_name")
        .eq("id", r.matched_lead_id)
        .maybeSingle()
    : { data: null };
  const email = (r.matched_email || lead?.email || matched?.email || "").trim();
  const { data: toursByEmail } = email
    ? await admin
        .from("tour_appointments")
        .select(
          "id,lead_id,status,scheduled_at,is_archived,confirm_token,confirmed_at,confirmation_source,contact_email,duration_minutes",
        )
        .eq("venue_id", FANCY)
        .ilike("contact_email", email)
    : { data: [] };
  reviewDetails.push({
    review: {
      id: r.id,
      status: r.status,
      lead_id: r.lead_id,
      matched: r.matched_lead_id,
      email: r.matched_email,
      name: r.matched_display_name,
      created: r.created_at,
    },
    leadExists: !!lead,
    matchedExists: !!matched,
    lead,
    matched,
    toursByEmail,
  });
}

const out = {
  archived_count: archived?.length ?? 0,
  null_lead_count: nullLead?.length ?? 0,
  archived,
  nullLead,
  reviewDetails,
};
writeFileSync(`${OUT}/audit2.json`, JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      archived_count: out.archived_count,
      null_lead_count: out.null_lead_count,
      archived_sample: (archived ?? []).slice(0, 8).map((t) => ({
        id: t.id,
        lead_id: t.lead_id,
        status: t.status,
        scheduled_at: t.scheduled_at,
        email: t.contact_email,
        confirmed_at: t.confirmed_at,
        source: t.confirmation_source,
        is_archived: t.is_archived,
      })),
      null_lead_sample: (nullLead ?? []).slice(0, 8).map((t) => ({
        id: t.id,
        status: t.status,
        scheduled_at: t.scheduled_at,
        email: t.contact_email,
        is_archived: t.is_archived,
        confirmed_at: t.confirmed_at,
      })),
      reviews: reviewDetails.map((d) => ({
        lead_id: d.review.lead_id,
        leadExists: d.leadExists,
        matched: d.review.matched,
        matchedExists: d.matchedExists,
        email: d.review.email,
        tourCount: d.toursByEmail?.length ?? 0,
        tours: d.toursByEmail,
      })),
    },
    null,
    2,
  ),
);
