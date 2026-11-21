/**
 * Disposable-venue acceptance for Public Forms starters.
 * Never touches Willow / Fancy / Daisy.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { seedPublicFormStarters } from "@/lib/public-forms/starters";
import { assertWritableQaVenue } from "@/lib/qa/protected-venues";

config({ path: ".env.local", quiet: true });

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = join(process.env.HOME!, "Desktop/HTC-willow-demo-cleanup-plan");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = `${Date.now()}`;
const report: Record<string, unknown> = { stamp, steps: [] as unknown[] };
const steps = report.steps as unknown[];

async function main() {
  const email = `jennifer+pfstarters.${stamp}@hellotocheers.com`;
  const { data: userData, error: uErr } = await admin.auth.admin.createUser({
    email,
    password: `Pf-${stamp}-Aa1x`,
    email_confirm: true,
  });
  if (uErr || !userData.user) throw uErr ?? new Error("createUser");
  const userId = userData.user.id;

  const { data: venue, error: vErr } = await admin
    .from("venues")
    .insert({
      owner_user_id: userId,
      name: `[DISPOSABLE-PF-STARTERS] ${stamp}`,
      email,
      setup_completed: true,
      setup_completed_at: new Date().toISOString(),
    })
    .select("id, name")
    .single();
  if (vErr || !venue) throw vErr ?? new Error("venue insert");

  assertWritableQaVenue({ venueId: venue.id, venueName: venue.name, purpose: "pf-starters-acceptance" });

  await admin.from("venue_staff").insert({
    venue_id: venue.id,
    user_id: userId,
    full_name: "PF Starter Owner",
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
  steps.push({ step: "venue_created", venueId: venue.id, name: venue.name });

  const seed1 = await seedPublicFormStarters(venue.id, admin as never);
  const seed2 = await seedPublicFormStarters(venue.id, admin as never);
  steps.push({ step: "seed1", seed1, step2: "seed2", seed2 });

  const { data: forms } = await admin
    .from("public_forms")
    .select("id, internal_name, public_title, status, public_key")
    .eq("venue_id", venue.id)
    .order("internal_name");
  steps.push({ step: "forms", forms });

  const target = forms?.find((f) => f.internal_name === "General Venue Inquiry");
  if (!target) throw new Error("missing General Venue Inquiry");

  await admin
    .from("public_forms")
    .update({ description: `Edited for acceptance ${stamp}`, status: "published" })
    .eq("id", target.id)
    .eq("venue_id", venue.id);

  const { data: published } = await admin
    .from("public_forms")
    .select("id, status, public_key")
    .eq("id", target.id)
    .single();

  let submitResult: unknown = null;
  try {
    const resp = await fetch(`${APP}/api/public/forms/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: published!.public_key,
        firstName: "Starter",
        lastName: `Accept${stamp}`,
        email: `pf-starter-${stamp}@hellotocheers-test.invalid`,
        phone: "555-0100",
        eventType: "wedding",
        eventDate: "2027-09-15",
        guestCount: 120,
        sourceData: {},
      }),
    });
    submitResult = { status: resp.status, body: (await resp.text()).slice(0, 800) };
  } catch (e) {
    submitResult = { error: e instanceof Error ? e.message : String(e) };
  }
  steps.push({ step: "submit", submitResult, publicKey: published?.public_key });

  const { data: leads } = await admin
    .from("leads")
    .select("id, email, source_data, sales_stage")
    .eq("venue_id", venue.id);
  const { count: clientCount } = await admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venue.id);
  steps.push({ step: "attribution", leads, clientCount });

  // Teardown
  await admin.from("public_form_questions").delete().eq("venue_id", venue.id);
  await admin.from("public_forms").delete().eq("venue_id", venue.id);
  await admin.from("leads").delete().eq("venue_id", venue.id);
  await admin.from("venue_staff").delete().eq("venue_id", venue.id);
  await admin.from("venues").delete().eq("id", venue.id);
  await admin.auth.admin.deleteUser(userId);
  steps.push({ step: "teardown_ok", venueId: venue.id });

  const submitOk =
    typeof submitResult === "object" &&
    submitResult !== null &&
    "status" in submitResult &&
    (submitResult as { status: number }).status >= 200 &&
    (submitResult as { status: number }).status < 300;
  report.ok =
    seed1.created.length === 4 &&
    seed2.created.length === 0 &&
    seed2.skipped.length === 4 &&
    (forms?.length ?? 0) === 4 &&
    published?.status === "published" &&
    submitOk &&
    (leads?.length ?? 0) >= 1 &&
    (clientCount ?? 0) === 0;

  writeFileSync(join(OUT, "PUBLIC-FORMS-DISPOSABLE-ACCEPTANCE.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  writeFileSync(
    join(OUT, "PUBLIC-FORMS-DISPOSABLE-ACCEPTANCE.json"),
    JSON.stringify({ ok: false, error: String(e), report }, null, 2),
  );
  process.exit(1);
});
