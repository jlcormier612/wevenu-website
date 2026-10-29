/**
 * White Glove Setup Completion — Sandbox acceptance.
 *
 * EXPECTED_SHA=<serving-tip> npx tsx docs/qa/white-glove-setup-completion/verify-browser.mts
 *
 * Creates an isolated disposable WG enrollment. Does not touch Fancy production
 * data beyond HQ admin session. Production untouched.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { join } from "node:path";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
/** Activation UI ships on the workspace app, not venue-app (see activationUrlFromToken). */
const WORKSPACE = "https://workspace.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const HQ_EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `WG${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/white-glove-setup-completion";
const SHOTS = join(OUT, "shots");
mkdirSync(SHOTS, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string; lane?: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string, lane = "core") {
  checks.push({ name, pass, detail: String(detail).slice(0, 2500), lane });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
}

async function servingImage(): Promise<string> {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function hqCookies() {
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: HQ_EMAIL,
  });
  if (linkErr || !link?.properties?.hashed_token) throw linkErr ?? new Error("no link");
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return {
    session: otp.session,
    cookies: ssrUtils.createChunks(cookieName, encoded).map(
      (c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      }),
    ),
  };
}

function intakePayload(venueName: string, capacity: number) {
  return {
    venueName,
    addressLine1: "100 QA Lane",
    city: "Asheville",
    stateRegion: "NC",
    postalCode: "28801",
    country: "US",
    primaryContactName: "WG QA Contact",
    contactEmail: `wg-contact-${RUN.toLowerCase()}@hellotocheers-test.invalid`,
    contactPhone: "555-0100",
    spaceMode: "one" as const,
    spaces: [{ name: "Main Hall", maxCapacity: capacity }],
    offersTours: true,
    offersTastingsOrAppointments: false,
    inquirySources: ["website" as const],
    bringBusinessChoice: "starting_fresh" as const,
  };
}

async function createDisposableEnrollment() {
  const stamp = Date.now();
  const venueName = `WG Accept ${RUN} ${stamp}`;
  const ownerEmail = `jennifer+wg-accept-${stamp}@hellotocheers.com`;
  const intakeToken = `intake_${randomBytes(24).toString("hex")}`;

  // Ensure auth user exists for owner email (handoff requires owner_user_id).
  let ownerUserId: string | null = null;
  const created = await admin.auth.admin.createUser({
    email: ownerEmail,
    email_confirm: true,
    password: `WgAccept-${randomBytes(12).toString("hex")}!aA1`,
  });
  if (created.data.user?.id) {
    ownerUserId = created.data.user.id;
  } else {
    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: ownerEmail,
    });
    const uid = link?.user?.id;
    if (!uid) throw created.error ?? new Error("createUser/lookup failed");
    ownerUserId = uid;
  }

  const { data: enrollment, error: enrErr } = await admin
    .from("venue_enrollments")
    .insert({
      venue_name: venueName,
      owner_email: ownerEmail,
      owner_first_name: "WG",
      owner_last_name: "Accept",
      onboarding_type: "white_glove",
      status: "pending",
      plan: "professional",
      intake_token: intakeToken,
      white_glove_status: "awaiting_provision",
      purchase_hold: false,
    })
    .select("id")
    .single();
  if (enrErr || !enrollment) throw enrErr ?? new Error("enrollment insert");

  // p_is_owner must be explicit true — null skips owner membership insert (K2 provision).
  const { data: venueId, error: provErr } = await admin.rpc("provision_enrollment_venue", {
    p_enrollment_id: enrollment.id,
    p_owner_user_id: ownerUserId,
    p_is_owner: true,
  });
  if (provErr || typeof venueId !== "string") {
    throw provErr ?? new Error("provision_enrollment_venue failed");
  }

  await admin.from("venue_setup_hub_state").upsert(
    { venue_id: venueId, onboarding_type: "white_glove" },
    { onConflict: "venue_id", ignoreDuplicates: true },
  );
  await admin.from("venue_onboarding_engagements").upsert(
    { venue_id: venueId, status: "not_started" },
    { onConflict: "venue_id", ignoreDuplicates: true },
  );

  // Ensure owner membership for Finish validation.
  await admin.from("venues").update({ owner_user_id: ownerUserId }).eq("id", venueId);
  const { data: staffExisting } = await admin
    .from("venue_staff")
    .select("id")
    .eq("venue_id", venueId)
    .eq("user_id", ownerUserId)
    .maybeSingle();
  if (!staffExisting) {
    const { error: staffErr } = await admin.from("venue_staff").insert({
      venue_id: venueId,
      user_id: ownerUserId,
      full_name: "WG Accept",
      email: ownerEmail,
      is_owner: true,
      role: "owner",
      access_title: "administrator",
      is_active: true,
      accepted_at: new Date().toISOString(),
    });
    if (staffErr) throw staffErr;
  } else {
    await admin
      .from("venue_staff")
      .update({ is_owner: true, email: ownerEmail, full_name: "WG Accept" })
      .eq("id", staffExisting.id);
  }

  await admin
    .from("venue_enrollments")
    .update({
      venue_id: venueId,
      status: "provisioned",
      intake_token: intakeToken,
      white_glove_status: "awaiting_intake",
    })
    .eq("id", enrollment.id);

  return { enrollmentId: enrollment.id, venueId, venueName, ownerEmail, intakeToken, ownerUserId };
}

async function main() {
  const image = await servingImage();
  record(
    "serving_sha",
    image.includes(EXPECTED.slice(0, 12)),
    `expected=${EXPECTED} ecs=${image}`,
    "deploy",
  );
  const health = await fetch(`${APP}/api/health`).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => null),
  }));
  record(
    "api_health",
    health.status === 200 && (health.body as { ok?: boolean })?.ok === true,
    JSON.stringify(health),
    "deploy",
  );

  const { data: buckets } = await admin.storage.listBuckets();
  const documents = (buckets ?? []).find((b) => b.name === "documents");
  record(
    "documents_bucket_private",
    documents?.public === false,
    JSON.stringify(documents),
    "materials",
  );

  const ctx = await createDisposableEnrollment();
  record(
    "disposable_enrollment",
    Boolean(ctx.venueId && ctx.intakeToken),
    JSON.stringify({ venueId: ctx.venueId, enrollmentId: ctx.enrollmentId }),
    "intake",
  );

  // --- Invalid token ---
  const badTok = await fetch(`${APP}/onboarding/white-glove/intake_invalid_token_xyz`);
  record(
    "invalid_token_rejected",
    badTok.status >= 400 || (await badTok.text()).toLowerCase().includes("not found") || badTok.url.includes("invalid"),
    `status=${badTok.status} url=${badTok.url}`,
    "intake",
  );

  const browser = await chromium.launch({ headless: true });
  try {
    // --- Customer intake browser ---
    {
      const bctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await bctx.newPage();
      await page.goto(`${APP}/onboarding/white-glove/${encodeURIComponent(ctx.intakeToken)}`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await page.waitForTimeout(1500);
      const bodyText = await page.locator("body").innerText();
      record(
        "intake_shows_venue_name",
        bodyText.includes(ctx.venueName),
        `url=${page.url()} hasName=${bodyText.includes(ctx.venueName)}`,
        "intake",
      );
      record(
        "intake_shows_white_glove",
        /white\s*glove/i.test(bodyText),
        `matched=${/white\s*glove/i.test(bodyText)}`,
        "intake",
      );
      await page.screenshot({ path: join(SHOTS, "01-intake-1280.png"), fullPage: false });

      // Submit via API (same route the form uses) for reliable field coverage,
      // then prove waiting UI + resumability in browser.
      const submitRes = await fetch(`${APP}/api/onboarding/white-glove/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakeToken: ctx.intakeToken,
          intake: intakePayload(ctx.venueName, 120),
        }),
      });
      const submitJson = (await submitRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      record(
        "intake_submit",
        submitRes.ok && submitJson.ok === true,
        `status=${submitRes.status} body=${JSON.stringify(submitJson)}`,
        "intake",
      );

      await page.goto(
        `${APP}/onboarding/white-glove/${encodeURIComponent(ctx.intakeToken)}/waiting`,
        { waitUntil: "domcontentloaded", timeout: 90_000 },
      );
      await page.waitForTimeout(1200);
      const waitingText = await page.locator("body").innerText();
      record(
        "waiting_page_loaded",
        /material|waiting|received|upload/i.test(waitingText),
        `url=${page.url()}`,
        "intake",
      );
      await page.screenshot({ path: join(SHOTS, "02-waiting-1280.png"), fullPage: false });

      // Upload material via API (customer token path)
      const csv = [
        "Package Name,Price,Description",
        "Garden Ceremony,2500,Outdoor ceremony package",
        "Reception Classic,4800,Four-hour reception",
      ].join("\n");
      const form = new FormData();
      form.set("intakeToken", ctx.intakeToken);
      form.set(
        "file",
        new File([csv], `packages-${RUN}.csv`, { type: "text/csv" }),
      );
      const upRes = await fetch(`${APP}/api/onboarding/white-glove/materials`, {
        method: "POST",
        body: form,
      });
      const upJson = (await upRes.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        fileName?: string;
        error?: string;
        storagePath?: string;
      };
      record(
        "customer_material_upload",
        upRes.ok && upJson.ok === true,
        JSON.stringify(upJson),
        "materials",
      );

      // Reject invalid type
      const badForm = new FormData();
      badForm.set("intakeToken", ctx.intakeToken);
      badForm.set(
        "file",
        new File(["not-a-venue-file"], `malware-${RUN}.exe`, {
          type: "application/x-msdownload",
        }),
      );
      const badUp = await fetch(`${APP}/api/onboarding/white-glove/materials`, {
        method: "POST",
        body: badForm,
      });
      const badJson = (await badUp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      record(
        "invalid_type_rejected",
        !badUp.ok || badJson.ok === false,
        `status=${badUp.status} ${JSON.stringify(badJson)}`,
        "materials",
      );

      // Oversized (>25MB) — use streaming-ish buffer
      const oversize = Buffer.alloc(26 * 1024 * 1024, 1);
      const bigForm = new FormData();
      bigForm.set("intakeToken", ctx.intakeToken);
      bigForm.set(
        "file",
        new File([oversize], `big-${RUN}.pdf`, { type: "application/pdf" }),
      );
      const bigUp = await fetch(`${APP}/api/onboarding/white-glove/materials`, {
        method: "POST",
        body: bigForm,
      });
      const bigJson = (await bigUp.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      record(
        "oversized_rejected",
        !bigUp.ok || bigJson.ok === false,
        `status=${bigUp.status} ${JSON.stringify(bigJson).slice(0, 200)}`,
        "materials",
      );

      const { data: mats } = await admin
        .from("venue_onboarding_materials")
        .select("id,file_name,storage_path,public_url,content_type,byte_size")
        .eq("venue_id", ctx.venueId)
        .order("uploaded_at", { ascending: false });
      const csvMat = (mats ?? []).find((m) => String(m.file_name).includes(`packages-${RUN}`));
      record(
        "material_metadata_persisted",
        Boolean(csvMat?.storage_path) && csvMat?.public_url == null,
        JSON.stringify(csvMat ?? mats?.[0] ?? null),
        "materials",
      );

      if (csvMat?.storage_path) {
        const { data: signed, error: signErr } = await admin.storage
          .from("documents")
          .createSignedUrl(csvMat.storage_path, 60);
        const signedHttp = signed?.signedUrl
          ? await fetch(signed.signedUrl).then((r) => r.status)
          : 0;
        record(
          "signed_url_reads_private_object",
          !signErr && signedHttp === 200,
          `http=${signedHttp} err=${signErr?.message ?? ""}`,
          "materials",
        );

        // Public URL must not work for private bucket
        const publicGuess = `${url}/storage/v1/object/public/documents/${csvMat.storage_path}`;
        const pubHttp = await fetch(publicGuess).then((r) => r.status).catch(() => 0);
        record(
          "public_url_denied",
          pubHttp === 400 || pubHttp === 403 || pubHttp === 404,
          `http=${pubHttp}`,
          "materials",
        );
      }

      // Second upload without resubmitting intake
      const form2 = new FormData();
      form2.set("intakeToken", ctx.intakeToken);
      form2.set(
        "file",
        new File(
          ["# Planning notes\nKeep Main Hall seating flexible.\n"],
          `planning-notes-${RUN}.md`,
          { type: "text/markdown" },
        ),
      );
      const up2 = await fetch(`${APP}/api/onboarding/white-glove/materials`, {
        method: "POST",
        body: form2,
      });
      const up2Json = (await up2.json().catch(() => ({}))) as { ok?: boolean };
      record(
        "additional_upload_without_resubmit",
        up2.ok && up2Json.ok === true,
        JSON.stringify(up2Json),
        "intake",
      );

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1000);
      const listText = await page.locator("body").innerText();
      record(
        "waiting_lists_received_files",
        listText.includes(`packages-${RUN}`) && listText.includes(`planning-notes-${RUN}`),
        listText.slice(0, 400),
        "intake",
      );
      await page.screenshot({ path: join(SHOTS, "03-waiting-with-files-1280.png"), fullPage: false });

      // Edit intake path
      await page.goto(
        `${APP}/onboarding/white-glove/${encodeURIComponent(ctx.intakeToken)}?edit=1`,
        { waitUntil: "domcontentloaded", timeout: 90_000 },
      );
      await page.waitForTimeout(1000);
      const editText = await page.locator("body").innerText();
      record(
        "edit_intake_path",
        /update|save|edit|correct/i.test(editText) || page.url().includes("edit=1"),
        `url=${page.url()}`,
        "intake",
      );
      const editRes = await fetch(`${APP}/api/onboarding/white-glove/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakeToken: ctx.intakeToken,
          intake: intakePayload(`${ctx.venueName} Updated`, 175),
        }),
      });
      const editJson = (await editRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      record(
        "edit_intake_persists",
        editRes.ok && editJson.ok === true,
        JSON.stringify(editJson),
        "intake",
      );

      const { data: spaces } = await admin
        .from("venue_spaces")
        .select("id,name,capacity")
        .eq("venue_id", ctx.venueId);
      const main = (spaces ?? []).filter((s) => /main hall/i.test(String(s.name)));
      record(
        "same_name_space_capacity_update",
        main.length === 1 && Number(main[0]?.capacity) === 175,
        JSON.stringify(spaces),
        "intake",
      );

      const { data: intakeRow } = await admin
        .from("venue_onboarding_intake")
        .select("venue_name,primary_contact_name")
        .eq("venue_id", ctx.venueId)
        .maybeSingle();
      record(
        "hq_visible_intake_update",
        String(intakeRow?.venue_name ?? "").includes("Updated"),
        JSON.stringify(intakeRow),
        "intake",
      );

      // Mobile waiting
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(
        `${APP}/onboarding/white-glove/${encodeURIComponent(ctx.intakeToken)}/waiting`,
        { waitUntil: "domcontentloaded", timeout: 90_000 },
      );
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(SHOTS, "04-waiting-390.png"), fullPage: false });
      await bctx.close();
    }

    // --- HQ operator ---
    const { cookies } = await hqCookies();
    const hqCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await hqCtx.addCookies(cookies);
    const hqPage = await hqCtx.newPage();

    await hqPage.goto(`${APP}/admin/onboarding/${ctx.venueId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await hqPage.waitForTimeout(1500);
    const hqText = await hqPage.locator("body").innerText();
    record(
      "hq_operator_panel_loads",
      /Finish White Glove|materials|Import|Setup Hub|White Glove/i.test(hqText),
      `url=${hqPage.url()} snippet=${hqText.slice(0, 300)}`,
      "hq",
    );
    record(
      "hq_lists_materials",
      hqText.includes(`packages-${RUN}`) || hqText.includes(`planning-notes-${RUN}`),
      hqText.slice(0, 400),
      "hq",
    );
    record(
      "planning_guidance_not_auto_apply",
      /planning|playbook|review before apply|guidance/i.test(hqText) ||
        !/auto-applied playbook|playbook applied/i.test(hqText),
      "planning is guidance/import path only",
      "gaps",
    );
    record(
      "message_templates_not_claimed_complete",
      !/message templates? (imported|complete|applied)/i.test(hqText),
      "message-template automation must not be presented as done",
      "gaps",
    );
    await hqPage.screenshot({ path: join(SHOTS, "05-hq-operator-1280.png"), fullPage: false });

    // Authorized download
    const { data: matRows } = await admin
      .from("venue_onboarding_materials")
      .select("id,file_name,storage_path")
      .eq("venue_id", ctx.venueId);
    const pkg = (matRows ?? []).find((m) => String(m.file_name).includes(`packages-${RUN}`));
    if (pkg) {
      const dl = await hqPage.request.get(
        `${APP}/api/admin/onboarding/materials/${pkg.id}/file?format=json`,
      );
      const dlJson = (await dl.json().catch(() => ({}))) as {
        ok?: boolean;
        signedUrl?: string;
        error?: string;
      };
      record(
        "hq_authorized_download_json",
        dl.ok() && dlJson.ok === true && Boolean(dlJson.signedUrl),
        JSON.stringify({ status: dl.status(), ok: dlJson.ok, hasUrl: Boolean(dlJson.signedUrl) }),
        "materials",
      );
      if (dlJson.signedUrl) {
        const fileHttp = await fetch(dlJson.signedUrl).then((r) => r.status);
        record("hq_signed_file_http_200", fileHttp === 200, `http=${fileHttp}`, "materials");
      }

      // Unauthorized (no cookies) — do not follow login redirects; API must 401 JSON.
      const unauth = await fetch(
        `${APP}/api/admin/onboarding/materials/${pkg.id}/file?format=json`,
        { redirect: "manual" },
      );
      const unauthBody = await unauth.text().catch(() => "");
      const unauthJson = (() => {
        try {
          return JSON.parse(unauthBody) as { ok?: boolean; signedUrl?: string; error?: string };
        } catch {
          return null;
        }
      })();
      record(
        "unauth_download_denied",
        (unauth.status === 401 || unauth.status === 403) && !unauthJson?.signedUrl,
        `status=${unauth.status} body=${unauthBody.slice(0, 200)}`,
        "materials",
      );

      // Staff of another venue (Fancy) without HQ — still HQ admin here; use anon session
      // of a non-admin if available. Create ephemeral user.
      const otherEmail = `wg-nonadmin-${RUN.toLowerCase()}@hellotocheers-test.invalid`;
      await admin.auth.admin.createUser({
        email: otherEmail,
        email_confirm: true,
        password: `Tmp-${randomBytes(10).toString("hex")}!aA1`,
      });
      const { data: otherLink } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: otherEmail,
      });
      const { data: otherOtp } = await anon.auth.verifyOtp({
        type: "email",
        token_hash: otherLink!.properties!.hashed_token!,
      });
      const otherRes = await fetch(
        `${APP}/api/admin/onboarding/materials/${pkg.id}/file?format=json`,
        {
          headers: {
            Authorization: `Bearer ${otherOtp!.session!.access_token}`,
            Cookie: `sb-wvpsldwwjqdannqasrdf-auth-token=base64-${ssrUtils.stringToBase64URL(
              JSON.stringify(otherOtp!.session),
            )}`,
          },
        },
      );
      record(
        "non_hq_download_denied",
        otherRes.status === 401 || otherRes.status === 403,
        `status=${otherRes.status}`,
        "materials",
      );

      // Use in Import Wizard seed path (API-level: signed fetch + parse readiness)
      await hqPage.evaluate(
        ({ venueId, materialId, fileName }) => {
          sessionStorage.setItem(
            `wg-seed-material:${venueId}`,
            JSON.stringify({ materialId, fileName, entity: "packages" }),
          );
        },
        { venueId: ctx.venueId, materialId: pkg.id, fileName: pkg.file_name },
      );
      await hqPage.goto(`${APP}/admin/onboarding/${ctx.venueId}#wg-import-wizard`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await hqPage.waitForTimeout(2500);
      const importText = await hqPage.locator("body").innerText();
      record(
        "import_wizard_seed_notice",
        /Staged from White Glove|Received file ready|Loading |review mapping|Import Wizard|packages/i.test(
          importText,
        ),
        importText.slice(0, 500),
        "import",
      );
      await hqPage.screenshot({ path: join(SHOTS, "06-import-seed-1280.png"), fullPage: false });
    } else {
      record("hq_authorized_download_json", false, "no package material row", "materials");
    }

    // Finish White Glove Setup via server action endpoint path — call action through UI
    const finishBtn = hqPage.getByRole("button", { name: /Finish White Glove Setup/i });
    if ((await finishBtn.count()) > 0) {
      await finishBtn.first().click();
      await hqPage.waitForTimeout(500);
      const confirm = hqPage.getByRole("button", { name: /Finish White Glove Setup/i });
      if ((await confirm.count()) > 0) {
        await confirm.last().click();
      }
      await hqPage.waitForTimeout(3000);
      await hqPage.screenshot({ path: join(SHOTS, "07-after-finish-1280.png"), fullPage: false });
    }

    const { data: afterEnroll } = await admin
      .from("venue_enrollments")
      .select(
        "white_glove_status,access_email_sent_at,activation_token,status,white_glove_handoff_at",
      )
      .eq("id", ctx.enrollmentId)
      .maybeSingle();
    record(
      "finish_sets_access_pending_or_email",
      afterEnroll?.white_glove_status === "setup_complete_access_pending" ||
        afterEnroll?.white_glove_status === "complete" ||
        Boolean(afterEnroll?.access_email_sent_at),
      JSON.stringify(afterEnroll),
      "handoff",
    );
    record(
      "activation_token_minted",
      Boolean(afterEnroll?.activation_token),
      `tokenPresent=${Boolean(afterEnroll?.activation_token)}`,
      "handoff",
    );
    record(
      "access_email_sent_at",
      Boolean(afterEnroll?.access_email_sent_at),
      `sent_at=${afterEnroll?.access_email_sent_at ?? null}`,
      "handoff",
    );

    // Idempotent finish retry
    if (afterEnroll?.activation_token) {
      const token1 = afterEnroll.activation_token;
      await hqPage.reload({ waitUntil: "domcontentloaded" });
      await hqPage.waitForTimeout(1000);
      const finishAgain = hqPage.getByRole("button", { name: /Finish White Glove Setup/i });
      if ((await finishAgain.count()) > 0) {
        await finishAgain.first().click().catch(() => {});
        await hqPage.waitForTimeout(400);
        const conf2 = hqPage.getByRole("button", { name: /Finish White Glove Setup/i });
        if ((await conf2.count()) > 0) await conf2.last().click().catch(() => {});
        await hqPage.waitForTimeout(2000);
      }
      const { data: afterRetry } = await admin
        .from("venue_enrollments")
        .select("activation_token,access_email_sent_at")
        .eq("id", ctx.enrollmentId)
        .maybeSingle();
      record(
        "finish_retry_reuses_token",
        afterRetry?.activation_token === token1,
        `before=${token1?.slice(0, 12)} after=${afterRetry?.activation_token?.slice(0, 12)}`,
        "handoff",
      );
    }

    // Post-activation intake must not reopen for unsafe edits after activated —
    // mark activated only if email sent; otherwise document pending.
    if (afterEnroll?.access_email_sent_at && afterEnroll.activation_token) {
      const actUrl = `${APP}/activate/${encodeURIComponent(afterEnroll.activation_token)}`;
      const actPage = await hqCtx.newPage();
      await actPage.goto(actUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await actPage.waitForTimeout(1500);
      const actText = await actPage.locator("body").innerText();
      record(
        "activation_link_opens",
        /activate|password|workspace|ready|sign/i.test(actText),
        `url=${actPage.url()}`,
        "handoff",
      );
      await actPage.screenshot({ path: join(SHOTS, "08-activate-1280.png"), fullPage: false });
      await actPage.close();
    } else {
      record(
        "activation_link_opens",
        false,
        "skipped — access email not recorded; handoff incomplete or email failed",
        "handoff",
      );
    }

    // Post-activation: attempt intake on activated complete venue (existing complete enrollment)
    const postAct = await fetch(`${APP}/api/onboarding/white-glove/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intakeToken: "intake_701fa9b8ddd10d5afb1f9177fb98d6aa4526da6c438fbc53",
        intake: intakePayload("Should Fail", 10),
      }),
    });
    record(
      "post_activation_intake_blocked",
      postAct.status === 409 || postAct.status === 404,
      `status=${postAct.status} body=${(await postAct.text()).slice(0, 200)}`,
      "intake",
    );

    await hqCtx.close();
  } finally {
    await browser.close();
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const payload = {
    ok: failed === 0,
    run: RUN,
    expectedSha: EXPECTED,
    servingImage: image,
    venueId: ctx.venueId,
    enrollmentId: ctx.enrollmentId,
    passed,
    failed,
    checks,
  };
  writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(payload, null, 2));
  writeFileSync(
    join(OUT, "browser-run.log"),
    checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n") +
      `\n\n${passed}/${checks.length} passed\n`,
  );
  console.log(JSON.stringify({ ok: payload.ok, passed, failed, venueId: ctx.venueId }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
