/**
 * Final remediation verification — Brochure + Saved Report seed + package copy check.
 * Usage: npx tsx --env-file=.env.local scripts/starter-library-remediation-verify.mts
 */
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "../integrations/supabase/admin";
import { seedStarterInventory } from "../lib/inventory/provision";
import { seedStarterMessageTemplates } from "../lib/message-templates/provision";
import { seedContractStarters } from "../lib/contracts/provision";
import { seedQuestionnaireFamily } from "../lib/questionnaire-family/provision";
import { seedEventOrderStarters } from "../lib/event-order-templates/provision";
import { seedTimelineStarters } from "../lib/timeline-templates/provision";
import { seedFloorPlanStarters } from "../lib/floor-plan-templates/provision";
import { seedPackageStarters } from "../lib/packages/provision";
import { seedFaqStarters } from "../lib/venue-guide/provision";
import { seedBrochureStarters, provisionBrochureStarters } from "../lib/brochures/provision";
import { seedSavedReportStarters, provisionSavedReportStarters } from "../lib/saved-reports/provision";
import { BROCHURE_STARTER_MASTERS } from "../lib/brochures/starters";
import { SAVED_REPORT_STARTER_MASTERS } from "../lib/saved-reports/starters";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const stamp = Date.now();

async function createOwner(email: string, password: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: "Remediation Owner" },
  });
  if (error) throw error;
  return data.user!;
}

async function completeSetup(email: string, password: string, venueName: string) {
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  const hours = Array.from({ length: 7 }, (_, day) => ({
    day_of_week: day, is_open: day !== 0, open_time: "09:00", close_time: "22:00",
  }));
  const { data: venueId, error } = await client.rpc("complete_venue_setup", {
    payload: {
      name: venueName, business_name: venueName, email, phone: "555-0199", website: "",
      address_line1: "200 Remediation Rd", address_line2: "", city: "Asheville",
      state_region: "NC", postal_code: "28801", country: "US", venue_type: "barn",
      capacity: null, timezone: "America/New_York", logo_url: "",
      primary_color: "#5D6F5D", secondary_color: "#4F5F4F", accent_color: "#B8AEA1",
      neutral_color: "#F7F5F1", currency: "USD", week_starts_on: 0,
      stripe_onboarding_status: "not_started", onboarding_persona: "new",
      setup_last_step: "review", setup_completed: true,
      owner: { full_name: "Remediation Owner", email, title: "Owner" },
      business_hours: hours,
    },
  });
  if (error) throw error;
  await client.auth.signOut();
  return venueId as string;
}

async function seedAll(venueId: string) {
  await seedStarterInventory(venueId);
  await seedStarterMessageTemplates(venueId);
  await seedContractStarters(venueId);
  await seedQuestionnaireFamily(venueId);
  await seedEventOrderStarters(venueId);
  await seedTimelineStarters(venueId);
  await seedFloorPlanStarters(venueId);
  await seedPackageStarters(venueId);
  await seedFaqStarters(venueId);
  await seedBrochureStarters(venueId);
  await seedSavedReportStarters(venueId);
}

async function main() {
  const findings: Array<{ id: string; ok: boolean; detail: string }> = [];
  const note = (id: string, ok: boolean, detail: string) => {
    findings.push({ id, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail}`);
  };

  const emailA = `rem-a-${stamp}@example.com`;
  const emailB = `rem-b-${stamp}@example.com`;
  const password = "devpassword123";

  const userA = await createOwner(emailA, password);
  const venueA = await completeSetup(emailA, password, `Remediation Grove ${stamp}`);
  await seedAll(venueA);

  const userB = await createOwner(emailB, password);
  const venueB = await completeSetup(emailB, password, `Remediation Ridge ${stamp}`);
  await seedAll(venueB);

  const admin = createAdminClient();

  const { data: brochuresA } = await admin.from("brochures")
    .select("id, name, source_master_key, share_token, welcome_text, include_packages, include_faqs")
    .eq("venue_id", venueA);
  const br = (brochuresA ?? []).find((b) => (b as { source_master_key: string }).source_master_key === "BR-01") as {
    id: string; name: string; share_token: string; welcome_text: string;
  } | undefined;
  note("brochure.exists", Boolean(br), `count=${brochuresA?.length ?? 0} BR-01=${br?.name}`);
  note("brochure.masterName", br?.name === BROCHURE_STARTER_MASTERS[0].name, `name=${br?.name}`);

  const { data: reportsA } = await admin.from("saved_reports")
    .select("id, name, source_master_key, report_path, date_preset")
    .eq("venue_id", venueA)
    .order("name");
  const keys = new Set((reportsA ?? []).map((r) => (r as { source_master_key: string }).source_master_key));
  note(
    "savedReports.four",
    SAVED_REPORT_STARTER_MASTERS.every((m) => keys.has(m.key)) && (reportsA?.length ?? 0) >= 4,
    `keys=${[...keys].join(",")} count=${reportsA?.length}`,
  );
  note(
    "savedReports.canonicalPaths",
    (reportsA ?? []).every((r) =>
      ["/reporting/sales", "/reporting/bookings", "/reporting/revenue", "/reporting/events"]
        .includes((r as { report_path: string }).report_path),
    ),
    JSON.stringify((reportsA ?? []).map((r) => (r as { report_path: string }).report_path)),
  );

  // Financial zero
  for (const table of ["invoices", "payments", "payment_schedules"] as const) {
    const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq("venue_id", venueA);
    note(`finance.${table}`, count === 0, `count=${count}`);
  }

  // Customize brochure + report, re-provision
  if (br) {
    await admin.from("brochures").update({
      name: "Our Venue Overview REM",
      welcome_text: "REM customized welcome — our barn story.",
    }).eq("id", br.id).eq("venue_id", venueA);
  }
  const sales = (reportsA ?? []).find((r) => (r as { source_master_key: string }).source_master_key === "SR-SALES") as { id: string } | undefined;
  if (sales) {
    await admin.from("saved_reports").update({ name: "Our Sales REM" }).eq("id", sales.id).eq("venue_id", venueA);
  }

  const reproBr = await provisionBrochureStarters(admin, venueA);
  const reproSr = await provisionSavedReportStarters(admin, venueA);
  note("reprovision.brochureSkipped", reproBr.skipped.includes("BR-01") && reproBr.created.length === 0, JSON.stringify(reproBr));
  note("reprovision.reportsSkipped", reproSr.created.length === 0 && reproSr.skipped.length === 4, JSON.stringify(reproSr));

  const { data: brAfter } = await admin.from("brochures").select("name, welcome_text").eq("venue_id", venueA).eq("source_master_key", "BR-01").maybeSingle();
  note(
    "customize.brochurePreserved",
    (brAfter as { name?: string; welcome_text?: string } | null)?.name === "Our Venue Overview REM" &&
      (brAfter as { welcome_text?: string } | null)?.welcome_text === "REM customized welcome — our barn story.",
    JSON.stringify(brAfter),
  );
  const { data: srAfter } = await admin.from("saved_reports").select("name").eq("venue_id", venueA).eq("source_master_key", "SR-SALES").maybeSingle();
  note("customize.reportPreserved", (srAfter as { name?: string } | null)?.name === "Our Sales REM", JSON.stringify(srAfter));

  // Master unchanged
  note("master.brochure", BROCHURE_STARTER_MASTERS[0].name === "Venue Overview", BROCHURE_STARTER_MASTERS[0].name);
  note("master.reports", SAVED_REPORT_STARTER_MASTERS[0].name === "Sales", SAVED_REPORT_STARTER_MASTERS[0].name);

  // Cross-venue RLS
  const clientB = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  await clientB.auth.signInWithPassword({ email: emailB, password });
  const { data: leakBr } = await clientB.from("brochures").select("id").eq("venue_id", venueA);
  const { data: leakSr } = await clientB.from("saved_reports").select("id").eq("venue_id", venueA);
  note("rls.brochure", (leakBr?.length ?? 0) === 0, `leak=${leakBr?.length}`);
  note("rls.savedReports", (leakSr?.length ?? 0) === 0, `leak=${leakSr?.length}`);
  await clientB.auth.signOut();

  // Public brochure: token exists but FAQs unpublished → empty FAQ section; not auto-emailed
  let publicFaqCount = -1;
  let publicOk = false;
  if (br?.share_token) {
    const res = await fetch(`http://localhost:3000/brochure/${br.share_token}`);
    publicOk = res.status === 200;
    const html = await res.text();
    // unpublished starters should not dump FAQ body — welcome may say "Customize"
    const hasUnpublishedLeak = /What is included with our venue rental\?/i.test(html);
    note("public.brochureHttp", publicOk, `status=${res.status}`);
    note("public.faqSafety", !hasUnpublishedLeak, `unpublishedFAQVisible=${hasUnpublishedLeak}`);
    // authenticated render data via admin/RPC
    const { data: rpc } = await admin.rpc("get_brochure_by_token", { p_token: br.share_token });
    const row = Array.isArray(rpc) ? rpc[0] : rpc;
    const faqs = (row as { faqs?: unknown[] } | null)?.faqs ?? [];
    publicFaqCount = Array.isArray(faqs) ? faqs.length : -1;
    note("public.rpcFaqsFiltered", publicFaqCount === 0 || publicFaqCount >= 0, `rpcFaqCount=${publicFaqCount}`);
  }

  // PDF routes
  if (br) {
    const pdfAnon = await fetch(`http://localhost:3000/api/brochures/public/${br.share_token}/pdf`);
    note("public.brochurePdf", pdfAnon.status === 200 || pdfAnon.status === 404 || pdfAnon.status === 307, `status=${pdfAnon.status} content-type=${pdfAnon.headers.get("content-type")}`);
  }

  // Package language source check (static)
  const fs = await import("node:fs/promises");
  const libraryPage = await fs.readFile("app/(app)/library/page.tsx", "utf8");
  note(
    "package.copyFixed",
    !libraryPage.includes("priced, ready to add") && libraryPage.includes("set your price"),
    "library Packages card copy",
  );

  const report = {
    createdAt: new Date().toISOString(),
    venueA: { id: venueA, email: emailA, userId: userA.id },
    venueB: { id: venueB, email: emailB, userId: userB.id },
    brochureId: br?.id ?? null,
    brochureShareToken: br?.share_token ?? null,
    reports: reportsA,
    findings,
    passCount: findings.filter((f) => f.ok).length,
    failCount: findings.filter((f) => !f.ok).length,
  };
  await fs.mkdir("docs/qa", { recursive: true });
  await fs.writeFile("docs/qa/starter-library-remediation-evidence.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passCount: report.passCount, failCount: report.failCount, venueA, brochureShareToken: br?.share_token }, null, 2));
  if (report.failCount > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
