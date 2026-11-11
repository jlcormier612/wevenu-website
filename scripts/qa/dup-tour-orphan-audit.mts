/**
 * Read-only audit: Fancy duplicate reviews + tours that may orphan availability.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";

config({ path: ".env.local", quiet: true });

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/duplicate-lead-tour-orphan";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: reviews } = await admin
    .from("lead_duplicate_reviews")
    .select("*")
    .eq("venue_id", FANCY)
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: tours } = await admin
    .from("tour_appointments")
    .select(
      "id,lead_id,status,scheduled_at,duration_minutes,contact_email,contact_name,confirm_token,confirmed_at,confirmation_source,created_at,origin,cancelled_at",
    )
    .eq("venue_id", FANCY)
    .order("created_at", { ascending: false })
    .limit(40);

  // Tours whose lead_id no longer resolves
  const leadIds = [...new Set((tours ?? []).map((t) => t.lead_id).filter(Boolean))] as string[];
  const { data: leads } = leadIds.length
    ? await admin.from("leads").select("id,first_name,last_name,email,status,sales_stage,created_at,deleted_at").in("id", leadIds)
    : { data: [] as { id: string }[] };

  // Check if deleted_at column exists / soft delete - try without deleted_at if fails
  let leadRows = leads;
  if (!leads) {
    const { data } = await admin
      .from("leads")
      .select("id,first_name,last_name,email,status,sales_stage,created_at")
      .in("id", leadIds);
    leadRows = data;
  }

  const leadById = new Map((leadRows ?? []).map((l) => [l.id, l]));
  const orphanTours = (tours ?? []).filter((t) => t.lead_id && !leadById.has(t.lead_id));
  const toursWithMissingLead = (tours ?? []).filter((t) => {
    if (!t.lead_id) return false;
    return !leadById.has(t.lead_id);
  });

  // Also: tours with lead_id set but lead gone — query any Fancy tour with lead_id not in leads
  const { data: allScheduled } = await admin
    .from("tour_appointments")
    .select(
      "id,lead_id,status,scheduled_at,duration_minutes,contact_email,contact_name,confirm_token,confirmed_at,confirmation_source,created_at,origin",
    )
    .eq("venue_id", FANCY)
    .in("status", ["scheduled", "confirmed"])
    .gte("scheduled_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(100);

  const schedLeadIds = [
    ...new Set((allScheduled ?? []).map((t) => t.lead_id).filter(Boolean)),
  ] as string[];
  const { data: schedLeads } = schedLeadIds.length
    ? await admin
        .from("leads")
        .select("id,first_name,last_name,email,status,sales_stage,created_at")
        .in("id", schedLeadIds)
    : { data: [] as { id: string }[] };
  const schedLeadSet = new Set((schedLeads ?? []).map((l) => l.id));
  const phantomBlocks = (allScheduled ?? []).filter(
    (t) => t.lead_id && !schedLeadSet.has(t.lead_id),
  );

  // Review lead pairs — check which leads still exist
  const reviewLeadIds = [
    ...new Set(
      (reviews ?? [])
        .flatMap((r) => [r.lead_id, r.matched_lead_id])
        .filter(Boolean),
    ),
  ] as string[];
  const { data: reviewLeads } = reviewLeadIds.length
    ? await admin
        .from("leads")
        .select("id,first_name,last_name,email,status,sales_stage,created_at")
        .in("id", reviewLeadIds)
    : { data: [] as { id: string }[] };
  const reviewLeadSet = new Set((reviewLeads ?? []).map((l) => l.id));

  const reviewsWithMissing = (reviews ?? []).map((r) => ({
    ...r,
    leadExists: reviewLeadSet.has(r.lead_id),
    matchedExists: r.matched_lead_id ? reviewLeadSet.has(r.matched_lead_id) : null,
  }));

  // For each phantom tour, check if same email has another surviving lead with/without tour
  const phantomDetails = [];
  for (const t of phantomBlocks) {
    const email = t.contact_email?.toLowerCase() ?? null;
    let siblingLeads: unknown[] = [];
    let siblingTours: unknown[] = [];
    if (email) {
      const { data: sibs } = await admin
        .from("leads")
        .select("id,first_name,last_name,email,status,sales_stage,created_at")
        .eq("venue_id", FANCY)
        .ilike("email", email);
      siblingLeads = sibs ?? [];
      const sibIds = (sibs ?? []).map((s) => s.id);
      if (sibIds.length) {
        const { data: st } = await admin
          .from("tour_appointments")
          .select("id,lead_id,status,scheduled_at,confirm_token,confirmed_at,confirmation_source")
          .in("lead_id", sibIds);
        siblingTours = st ?? [];
      }
    }
    phantomDetails.push({ tour: t, siblingLeads, siblingTours });
  }

  const out = {
    at: new Date().toISOString(),
    reviews: reviewsWithMissing,
    recentTours: tours,
    orphanToursFromRecent: toursWithMissingLead,
    phantomScheduledConfirmed: phantomBlocks,
    phantomDetails,
    reviewLeads,
  };
  writeFileSync(`${OUT}/audit-snapshot.json`, JSON.stringify(out, null, 2));
  console.log(
    JSON.stringify(
      {
        reviewCount: reviews?.length ?? 0,
        phantomCount: phantomBlocks.length,
        phantoms: phantomBlocks.map((t) => ({
          id: t.id,
          lead_id: t.lead_id,
          status: t.status,
          scheduled_at: t.scheduled_at,
          email: t.contact_email,
          confirmed_at: t.confirmed_at,
          confirmation_source: t.confirmation_source,
        })),
        reviewsMissingLead: reviewsWithMissing
          .filter((r) => !r.leadExists || r.matchedExists === false)
          .map((r) => ({
            lead_id: r.lead_id,
            leadExists: r.leadExists,
            matched_lead_id: r.matched_lead_id,
            matchedExists: r.matchedExists,
            status: r.status,
            email: r.matched_email,
          })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
