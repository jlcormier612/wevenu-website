/**
 * Forensic probe — document CSV missing vs bogus storage paths (Sandbox only).
 * Does not mutate Production. Uses synthetic disposable venue.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "fs";
import { genericCsvAdapter } from "../../../lib/migration/sources/generic-csv";

config({ path: ".env.local", quiet: true });

const SANDBOX_REF = "wvpsldwwjqdannqasrdf";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(SANDBOX_REF)) {
  throw new Error("Refusing — not Sandbox");
}

mkdirSync("docs/qa/exclusion-forensic", { recursive: true });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 300)}`);
}

async function main() {
  // A1 — missing storage fields rejected at normalize (no silent drop)
  const missing = genericCsvAdapter.normalizeRow(
    { name: "Ghost", fileName: "ghost.pdf", clientEmail: "a@b.c", eventDate: "2026-11-01" },
    "document",
  );
  record(
    "normalize_missing_storage_rejected",
    !missing.ok && /storagePath|storageUrl|uploaded file/i.test(!missing.ok ? missing.error : ""),
    missing.ok ? "unexpectedly ok" : missing.error,
  );

  // A2 — key_date / payment normalize refuse
  const kd = genericCsvAdapter.normalizeRow({ label: "Rehearsal", date: "2026-11-01", clientEmail: "a@b.c" }, "key_date");
  record("normalize_key_date_retired", !kd.ok && /retired/i.test(!kd.ok ? kd.error : ""), kd.ok ? "ok" : kd.error);
  const pay = genericCsvAdapter.normalizeRow({ amount: "500", clientEmail: "a@b.c" }, "payment");
  record("normalize_payment_redirects", !pay.ok && /Active commitment/i.test(!pay.ok ? pay.error : ""), pay.ok ? "ok" : pay.error);

  // B — commit with fabricated storage path (object does not exist)
  const stamp = Date.now();
  const { data: user, error: uErr } = await admin.auth.admin.createUser({
    email: `jennifer+docprobe.${stamp}@hellotocheers.com`,
    password: `Dp-${stamp}-Aa1x`,
    email_confirm: true,
  });
  if (uErr || !user.user) throw uErr ?? new Error("user");
  const { data: venue, error: vErr } = await admin.from("venues").insert({
    owner_user_id: user.user.id,
    name: `Doc Probe ${stamp}`,
    email: `v.docprobe.${stamp}@hellotocheers.com`,
  }).select("id").single();
  if (vErr || !venue) throw vErr ?? new Error("venue");
  const venueId = venue.id as string;

  const { data: clientRow } = await admin.from("clients").insert({
    venue_id: venueId,
    first_name: "DocProbe",
    last_name: "Client",
    email: `doc.probe.${stamp}@example.invalid`,
  }).select("id").single();
  const { data: eventRow } = await admin.from("events").insert({
    venue_id: venueId,
    client_id: clientRow!.id,
    name: "DocProbe Event",
    event_date: "2026-11-15",
    status: "confirmed",
  }).select("id").single();

  const fakePath = `${venueId}/migration-cert/does-not-exist-${stamp}.pdf`;
  const fakeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${fakePath}`;

  // Confirm object missing
  const listed = await admin.storage.from("documents").list(`${venueId}/migration-cert`, { search: `does-not-exist-${stamp}` });
  record("storage_object_absent", (listed.data ?? []).length === 0, `listed=${listed.data?.length} err=${listed.error?.message}`);

  const { data: doc, error: dErr } = await admin.from("documents").insert({
    venue_id: venueId,
    event_id: eventRow!.id,
    name: "Bogus Path Contract",
    file_name: "bogus.pdf",
    file_size: 0,
    mime_type: "application/pdf",
    storage_path: fakePath,
    storage_url: fakeUrl,
    category: "contract",
    notes: "forensic probe — fabricated path",
    tags: ["migration", "forensic"],
    uploaded_by_type: "venue",
  }).select("id,storage_path,event_id").single();

  record(
    "db_row_created_without_storage_object",
    !dErr && !!doc?.id,
    dErr?.message ?? `doc=${doc?.id?.slice(0, 8)} path=${doc?.storage_path}`,
  );

  // Can we open/download the object?
  const dl = await admin.storage.from("documents").download(fakePath);
  record(
    "download_fails_for_missing_object",
    !!dl.error,
    dl.error?.message ?? "unexpected download success",
  );

  // Cleanup probe doc row (keep venue for audit trail per instructions? preserve disposable — keep venue, delete bogus doc to avoid litter)
  if (doc?.id) {
    await admin.from("documents").delete().eq("id", doc.id).eq("venue_id", venueId);
  }

  writeFileSync(
    "docs/qa/exclusion-forensic/document-probe-results.json",
    JSON.stringify({ venueId, eventId: eventRow?.id, checks, at: new Date().toISOString() }, null, 2),
  );
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n${checks.length - failed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
