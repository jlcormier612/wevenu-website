/**
 * Heal Sandbox orphaned tours: archived + null lead_id + occupying status.
 * Read-only report first unless APPLY=1.
 * No customer emails — direct status update only.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";

config({ path: ".env.local", quiet: true });

const APPLY = process.env.APPLY === "1";
const OUT = "docs/qa/duplicate-lead-tour-orphan";
mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("refusing non-sandbox");
}

const { data: orphans, error } = await admin
  .from("tour_appointments")
  .select(
    "id,venue_id,lead_id,status,scheduled_at,contact_email,contact_name,confirm_token,is_archived,confirmed_at,confirmation_source",
  )
  .eq("is_archived", true)
  .is("lead_id", null)
  .in("status", ["scheduled", "confirmed"]);
if (error) throw error;

const report = {
  at: new Date().toISOString(),
  apply: APPLY,
  count: orphans?.length ?? 0,
  orphans,
  intended: "UPDATE status=cancelled; cancel pending task_reminders; no emails",
};
writeFileSync(`${OUT}/heal-plan.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ apply: APPLY, count: report.count, ids: (orphans ?? []).map((o) => o.id) }, null, 2));

if (!APPLY) {
  console.log("Dry-run only. Re-run with APPLY=1 to cancel.");
  process.exit(0);
}

const ids = (orphans ?? []).map((o) => o.id);
if (ids.length === 0) {
  writeFileSync(`${OUT}/heal-result.json`, JSON.stringify({ ok: true, cancelled: 0 }, null, 2));
  process.exit(0);
}

const { error: cancelErr } = await admin
  .from("tour_appointments")
  .update({ status: "cancelled" })
  .in("id", ids)
  .in("status", ["scheduled", "confirmed"]);
if (cancelErr) throw cancelErr;

await admin.from("task_reminders").update({ status: "cancelled" }).in("tour_appointment_id", ids).eq("status", "pending");

const { data: after } = await admin
  .from("tour_appointments")
  .select("id,status,is_archived,lead_id,scheduled_at,contact_email")
  .in("id", ids);

writeFileSync(
  `${OUT}/heal-result.json`,
  JSON.stringify({ ok: true, cancelled: ids.length, after, emailsSent: [] }, null, 2),
);
console.log(JSON.stringify({ ok: true, after }, null, 2));
