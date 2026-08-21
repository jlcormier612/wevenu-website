/**
 * Sandbox CRM E2E verification — Marketing write → Postgres → Workspace-visible SoT.
 *
 * Usage (from repo root, with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set):
 *   npx tsx scripts/verify-crm-sandbox-e2e.mts
 *
 * Optional:
 *   PRODUCT_SYNC_API_KEY — enrollment upsert / WG bridge checks
 *   PRODUCT_API_BASE_URL — default https://app.sandbox.hellotocheers.com
 *   MARKETING_URL — default https://sandbox.hellotocheers.com
 *   WORKSPACE_URL — default https://workspace.sandbox.hellotocheers.com
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const MARKETING_URL = (process.env.MARKETING_URL || "https://sandbox.hellotocheers.com").replace(/\/$/, "");
const WORKSPACE_URL = (process.env.WORKSPACE_URL || "https://workspace.sandbox.hellotocheers.com").replace(/\/$/, "");
const PRODUCT_API = (process.env.PRODUCT_API_BASE_URL || "https://app.sandbox.hellotocheers.com").replace(/\/$/, "");
const PRODUCT_SYNC_API_KEY = (process.env.PRODUCT_SYNC_API_KEY || "").trim();

const stamp = Date.now();
const testEmail = `crm-e2e-${stamp}@hellotocheers-test.invalid`;
const testVenue = `CRM E2E Venue ${stamp}`;
const sessionId = `cs_test_crm_e2e_${stamp}`;
const subId = `sub_test_crm_e2e_${stamp}`;

type Result = { name: string; ok: boolean; detail: string };

const results: Result[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}: ${detail}`);
}

function admin() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main() {
  console.log("=== CRM sandbox E2E ===");
  console.log({ MARKETING_URL, WORKSPACE_URL, PRODUCT_API, testEmail, testVenue });

  const sb = admin();

  // --- Preflight: tables + version ---
  const { data: metaBefore, error: metaErr } = await sb
    .from("htc_crm_store_meta")
    .select("version")
    .eq("id", 1)
    .single();
  if (metaErr) {
    record("preflight.htc_crm_store_meta", false, metaErr.message);
    throw metaErr;
  }
  const versionBefore = metaBefore?.version ?? 0;
  record("preflight.htc_crm_store_meta", true, `version=${versionBefore}`);

  // --- 1. Marketing contact ingest ---
  const inquiryRes = await fetch(`${MARKETING_URL}/api/inquiries`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "contact",
      fields: {
        firstName: "CRM",
        lastName: "E2E",
        email: testEmail,
        venue: testVenue,
        message: "Sandbox CRM durability verification — safe to ignore.",
      },
    }),
  });
  const inquiryBody = (await inquiryRes.json().catch(() => ({}))) as {
    ok?: boolean;
    id?: string;
    error?: string;
  };
  record(
    "1.marketing.inquiry_http",
    inquiryRes.ok && inquiryBody.ok === true,
    `status=${inquiryRes.status} body=${JSON.stringify(inquiryBody)}`,
  );

  // Allow marketing → Postgres write to settle
  await new Promise((r) => setTimeout(r, 1500));

  const { data: relRows, error: relErr } = await sb
    .from("htc_crm_relationships")
    .select("id, owner_email, status, sales_stage, document, updated_at")
    .ilike("owner_email", testEmail)
    .limit(5);
  if (relErr) {
    record("1.postgres.relationship_row", false, relErr.message);
  } else {
    const row = relRows?.[0];
    record(
      "1.postgres.relationship_row",
      Boolean(row?.id),
      row
        ? `id=${row.id} status=${row.status} sales_stage=${row.sales_stage}`
        : `no row for ${testEmail} (count=${relRows?.length ?? 0})`,
    );
    if (row?.id) {
      (globalThis as { __crmRelId?: string }).__crmRelId = row.id;
    }
  }

  const { data: metaAfter } = await sb
    .from("htc_crm_store_meta")
    .select("version")
    .eq("id", 1)
    .single();
  const versionAfter = metaAfter?.version ?? versionBefore;
  record(
    "1.postgres.version_bumped",
    versionAfter > versionBefore,
    `before=${versionBefore} after=${versionAfter}`,
  );

  // Load via RPC (same path Workspace uses)
  const { data: loaded, error: loadErr } = await sb.rpc("htc_crm_load_store");
  if (loadErr) {
    record("1.rpc.load_store", false, loadErr.message);
  } else {
    const payload = loaded as { version?: number; store?: { relationships?: { id: string; owner?: { email?: string } }[] } };
    const store = payload?.store ?? (loaded as { relationships?: { id: string; owner?: { email?: string } }[] });
    const rels = store?.relationships ?? [];
    const hit = rels.find(
      (r) => (r.owner?.email || "").toLowerCase() === testEmail.toLowerCase(),
    );
    record(
      "1.rpc.load_store_contains_relationship",
      Boolean(hit?.id),
      hit ? `id=${hit.id} version=${payload?.version}` : `not in load_store (${rels.length} total)`,
    );
  }

  // Workspace health / login page reachable (UI login verified separately via browser if needed)
  const wsHome = await fetch(`${WORKSPACE_URL}/login`, { redirect: "manual" });
  record(
    "1.workspace.login_reachable",
    wsHome.status >= 200 && wsHome.status < 400,
    `status=${wsHome.status}`,
  );

  // --- 3. Enrollment idempotency via product upsert (durable venue_enrollments) ---
  if (!PRODUCT_SYNC_API_KEY) {
    record("3.enrollment.upsert", false, "PRODUCT_SYNC_API_KEY not set — skipped");
  } else {
    const actToken = `act_e2e_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    async function upsert(token: string | null) {
      return fetch(`${PRODUCT_API}/api/internal/enrollment/upsert`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${PRODUCT_SYNC_API_KEY}`,
        },
        body: JSON.stringify({
          stripeCheckoutSessionId: sessionId,
          stripeCustomerId: `cus_e2e_${stamp}`,
          stripeSubscriptionId: subId,
          venueName: testVenue,
          ownerEmail: testEmail,
          plan: "gather",
          onboardingType: "white_glove",
          activationToken: token,
        }),
      });
    }

    const first = await upsert(null);
    const firstBody = (await first.json()) as { ok?: boolean; id?: string; error?: string };
    record(
      "3.enrollment.upsert_first",
      first.ok && firstBody.ok === true && Boolean(firstBody.id),
      JSON.stringify(firstBody),
    );
    const enrollmentId = firstBody.id;

    const second = await upsert(null);
    const secondBody = (await second.json()) as { ok?: boolean; id?: string };
    record(
      "3.enrollment.upsert_retry_same_id",
      second.ok && secondBody.ok === true && secondBody.id === enrollmentId,
      `first=${enrollmentId} second=${secondBody.id}`,
    );

    const { data: enrollRows } = await sb
      .from("venue_enrollments")
      .select("id, stripe_checkout_session_id, activation_token, onboarding_type, status")
      .eq("stripe_checkout_session_id", sessionId);
    record(
      "3.enrollment.single_row",
      (enrollRows?.length ?? 0) === 1,
      `count=${enrollRows?.length} rows=${JSON.stringify(enrollRows)}`,
    );

    // --- 4. White Glove: activation token before "email would send" ---
    const wg = await upsert(actToken);
    const wgBody = (await wg.json()) as { ok?: boolean; id?: string };
    const { data: afterToken } = await sb
      .from("venue_enrollments")
      .select("id, activation_token, activation_token_created_at, onboarding_type")
      .eq("stripe_checkout_session_id", sessionId)
      .maybeSingle();
    const tokenPresent = afterToken?.activation_token === actToken;
    record(
      "4.white_glove.activation_token_in_venue_enrollments",
      wg.ok && wgBody.ok === true && tokenPresent,
      `token_match=${tokenPresent} created_at=${afterToken?.activation_token_created_at} body=${JSON.stringify(wgBody)}`,
    );
    record(
      "4.white_glove.order_note",
      tokenPresent,
      "DB shows activation_token set via upsertVenueEnrollment path (same bridge Launch Workspace calls before Welcome Home). Full Launch Workspace UI email send not asserted here.",
    );
  }

  // --- 5. Backend confirmation hints ---
  record(
    "5.backend.note",
    true,
    "If Marketing inquiry created an htc_crm_relationships row and bumped htc_crm_store_meta.version, Marketing used Postgres (JSONL cannot write these tables). HTC_CRM_STORE=file would leave Postgres unchanged.",
  );

  console.log("\n=== Summary ===");
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.name}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
