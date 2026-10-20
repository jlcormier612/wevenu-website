import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

async function main() {
  const stamp = Date.now();
  const { data: a } = await admin.from("leads").insert({
    venue_id: FANCY, first_name: "RA", last_name: `T${stamp}`,
    email: `ra${stamp}@example.invalid`, sales_stage: "new_inquiry",
    exclude_from_business_reporting: true,
  }).select("id,updated_at").single();
  await new Promise((r) => setTimeout(r, 50));
  const { data: b } = await admin.from("leads").insert({
    venue_id: FANCY, first_name: "RB", last_name: `T${stamp}`,
    email: `rb${stamp}@example.invalid`, phone: "555-0001",
    sales_stage: "new_inquiry", exclude_from_business_reporting: true,
  }).select("id,updated_at").single();

  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink", email: "jennifer@hellotocheers.com",
  });
  const { data: otp, error: oe } = await anon.auth.verifyOtp({
    type: "email", token_hash: link!.properties!.hashed_token!,
  });
  console.log("otp", !!otp?.session, oe?.message);

  const userClient = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${otp!.session!.access_token}` } },
  });

  const { data: a2 } = await admin.from("leads").select("updated_at").eq("id", a!.id).single();
  const { data: b2 } = await admin.from("leads").select("updated_at").eq("id", b!.id).single();
  const { data, error } = await userClient.rpc("merge_leads_v1", {
    p_venue_id: FANCY,
    p_primary_id: a!.id,
    p_secondary_id: b!.id,
    p_primary_updated_at: a2!.updated_at,
    p_secondary_updated_at: b2!.updated_at,
    p_field_patch: { phone: "555-0001" },
    p_tour_cancel_ids: [],
    p_audit: { browser_diag: true },
  });
  console.log(JSON.stringify({ data, error }, null, 2));

  const { data: staff } = await admin.from("venue_staff")
    .select("user_id,is_active,is_owner,role,email")
    .eq("venue_id", FANCY)
    .ilike("email", "jennifer@hellotocheers.com");
  console.log("staff", staff);

  const { data: after } = await admin.from("leads")
    .select("id,merged_into_lead_id,phone")
    .in("id", [a!.id, b!.id]);
  console.log("after", after);
}

main().catch((e) => { console.error(e); process.exit(1); });
