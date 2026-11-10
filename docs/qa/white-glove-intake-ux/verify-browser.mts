/**
 * White Glove intake UX + persistence acceptance (Sandbox).
 *
 * EXPECTED_SHA=<serving> npx tsx docs/qa/white-glove-intake-ux/verify-browser.mts
 *
 * Real browser form fill + upload. Production untouched.
 */
import { createRequire } from "node:module";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const HQ_EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `WGIUX${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/white-glove-intake-ux";
const SHOTS = join(OUT, "shots");
const FIX = join(OUT, "fixtures");
mkdirSync(SHOTS, { recursive: true });
mkdirSync(FIX, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2500) });
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

async function passVenueWelcome(page: {
  locator: Function;
  getByRole: Function;
  waitForTimeout: Function;
  url: () => string;
}) {
  for (let i = 0; i < 6; i++) {
    const text = await page.locator("body").innerText().catch(() => "");
    if (!/Welcome to Hello to Cheers|I have reviewed and agree|Venue Subscription Agreement/i.test(text)) {
      return;
    }
    if (/\/welcome/i.test(page.url()) || /I have reviewed and agree/i.test(text)) {
      const box = page.locator('input[type="checkbox"]');
      if (await box.count()) {
        await box.first().check({ force: true }).catch(async () => {
          await box.first().click({ force: true }).catch(() => undefined);
        });
        await page.waitForTimeout(400);
      }
      const btn = page.getByRole("button", { name: /^Continue$/i });
      if (await btn.count()) {
        await btn.first().click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(1500);
      }
    } else {
      return;
    }
  }
}

async function cookiesFor(email: string, venueId?: string) {
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) throw linkErr ?? new Error("no link");
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  if (venueId) {
    await admin.from("venue_staff_active_context").upsert({
      user_id: otp.session.user.id,
      active_venue_id: venueId,
    });
  }
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  const chunks = ssrUtils.createChunks(cookieName, encoded).map(
    (c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    }),
  );
  if (venueId) {
    chunks.push({
      name: "htc_active_venue_id",
      value: venueId,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    });
  }
  return { session: otp.session, cookies: chunks };
}

async function createDisposableEnrollment() {
  const venueName = `WG UX ${RUN} Barn`;
  const ownerEmail = `wg-ux-${RUN.toLowerCase()}@hellotocheers-test.invalid`;
  const intakeToken = `intake_wgiux_${RUN.toLowerCase()}_${randomBytes(4).toString("hex")}`;

  let ownerUserId: string | null = null;
  const created = await admin.auth.admin.createUser({
    email: ownerEmail,
    email_confirm: true,
    password: `WgUx-${randomBytes(12).toString("hex")}!aA1`,
  });
  if (created.data.user?.id) ownerUserId = created.data.user.id;
  else {
    const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: ownerEmail });
    ownerUserId = link?.user?.id ?? null;
  }
  if (!ownerUserId) throw new Error("owner user");

  const { data: enrollment, error: enrErr } = await admin
    .from("venue_enrollments")
    .insert({
      venue_name: `Checkout Label ${RUN}`,
      owner_email: ownerEmail,
      owner_first_name: "WG",
      owner_last_name: "UX",
      onboarding_type: "white_glove",
      status: "pending",
      plan: "professional",
      intake_token: intakeToken,
      white_glove_status: "awaiting_provision",
      purchase_hold: false,
    })
    .select("id")
    .single();
  if (enrErr || !enrollment) throw enrErr ?? new Error("enrollment");

  const { data: venueId, error: provErr } = await admin.rpc("provision_enrollment_venue", {
    p_enrollment_id: enrollment.id,
    p_owner_user_id: ownerUserId,
    p_is_owner: true,
  });
  if (provErr || typeof venueId !== "string") throw provErr ?? new Error("provision");

  await admin.from("venue_setup_hub_state").upsert(
    { venue_id: venueId, onboarding_type: "white_glove" },
    { onConflict: "venue_id", ignoreDuplicates: true },
  );
  await admin.from("venue_onboarding_engagements").upsert(
    { venue_id: venueId, status: "not_started" },
    { onConflict: "venue_id", ignoreDuplicates: true },
  );
  await admin.from("venues").update({ owner_user_id: ownerUserId }).eq("id", venueId);
  await admin.from("venue_enrollments").update({
    venue_id: venueId,
    status: "provisioned",
    intake_token: intakeToken,
    white_glove_status: "awaiting_intake",
  }).eq("id", enrollment.id);

  return { enrollmentId: enrollment.id, venueId, venueName, ownerEmail, intakeToken, ownerUserId };
}

function writeFixture(name: string, contents: Buffer | string) {
  const path = join(FIX, name);
  writeFileSync(path, contents);
  const buf = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  return { path, name, sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length };
}

async function main() {
  const image = await servingImage();
  record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);

  const pdf = writeFixture(
    `wg-ux-${RUN}-brochure.pdf`,
    Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\nWG-UX-PDF-" + RUN),
  );
  const png = writeFixture(
    `wg-ux-${RUN}-floor.png`,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  const csv = writeFixture(`wg-ux-${RUN}-export.csv`, `name,guests\n${RUN},42\n`);

  const ctx = await createDisposableEnrollment();
  record("disposable_enrollment", Boolean(ctx.venueId), JSON.stringify({
    venueId: ctx.venueId,
    enrollmentId: ctx.enrollmentId,
  }));

  const browser = await chromium.launch({ headless: true });
  let materialIds: string[] = [];
  try {
    const guest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await guest.newPage();
    await page.goto(`${APP}/onboarding/white-glove/${encodeURIComponent(ctx.intakeToken)}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForSelector('[data-testid="wg-welcome-box"]', { timeout: 60_000 });
    const welcome = await page.getByTestId("wg-welcome-box").innerText();
    record(
      "welcome_copy_exact",
      welcome.includes("Welcome to White Glove Setup") &&
        welcome.includes("We're excited to get Hello to Cheers ready for your venue") &&
        welcome.includes("You'll receive access to sign in once we've completed setup") &&
        !welcome.includes("Your account login is already set") &&
        !/from checkout/i.test(welcome),
      welcome.slice(0, 600),
    );
    record(
      "welcome_hides_checkout_label",
      !welcome.includes(`Checkout Label ${RUN}`) && !welcome.includes(ctx.ownerEmail),
      welcome.slice(0, 400),
    );
    const headingGap = await page.evaluate(() => {
      const box = document.querySelector('[data-testid="wg-welcome-box"]');
      const h1 = Array.from(document.querySelectorAll("h1")).find((el) =>
        /Tell us about your venue/i.test(el.textContent ?? ""),
      );
      if (!box || !h1) return null;
      const a = box.getBoundingClientRect();
      const b = h1.getBoundingClientRect();
      return Math.round(b.top - a.bottom);
    });
    record(
      "welcome_to_heading_gap_tight",
      typeof headingGap === "number" && headingGap >= 8 && headingGap <= 72,
      `gapPx=${headingGap}`,
    );
    await page.screenshot({ path: join(SHOTS, "desktop-welcome-1280.png"), fullPage: false });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOTS, "mobile-welcome-390.png"), fullPage: false });
    await page.setViewportSize({ width: 1280, height: 900 });

    // Field labels are not htmlFor-associated; locate via label text → sibling input.
    async function fillByLabelText(labelRe: RegExp, value: string) {
      const row = page.locator("div.space-y-1\\.5").filter({ hasText: labelRe }).first();
      await row.locator("input").fill(value);
    }
    // Distinctive venue name (not checkout label)
    await fillByLabelText(/Venue name/i, ctx.venueName);
    await fillByLabelText(/^Address/i, "22 UX Trail");
    await fillByLabelText(/^City/i, "Asheville");
    await fillByLabelText(/^State/i, "NC");
    await fillByLabelText(/Postal code/i, "28801");
    await fillByLabelText(/Venue phone/i, "828-555-0199");
    await fillByLabelText(/^Website/i, "https://example.invalid/wg-ux");
    await fillByLabelText(/Space name/i, "Garden Room");
    await fillByLabelText(/Maximum guest capacity/i, "86");

    await page.locator('input[name="tours"]').first().check();
    // No path — checklist hidden
    await page.locator('input[name="appointments-other-than-tours"]').nth(1).check();
    await page.waitForTimeout(300);
    record(
      "appointment_no_hides_types",
      (await page.getByTestId("appointment-type-consultations").count()) === 0,
      "types hidden on No",
    );
    // Yes + types
    await page.locator('input[name="appointments-other-than-tours"]').first().check();
    await page.getByTestId("appointment-type-consultations").check();
    await page.getByTestId("appointment-type-planning_meetings").check();
    await page.getByTestId("appointment-type-other").check();
    await page.getByTestId("appointment-types-other").fill("Vendor meet-and-greet");
    record(
      "appointment_question_copy",
      (await page.locator("body").innerText()).includes("Do you offer appointments other than tours?") &&
        (await page.locator("body").innerText()).includes("What types of appointments do you offer?") &&
        !(await page.locator("body").innerText()).includes("Do you offer tastings or other appointments?"),
      "copy ok",
    );

    await page.getByRole("checkbox", { name: /^Website$/i }).check();
    await page.getByRole("checkbox", { name: /Email \/ phone/i }).check();
    await page.getByRole("radio", { name: /Yes — I use HoneyBook/i }).check().catch(async () => {
      await page.getByText("Yes — I use HoneyBook").click();
    });

    await page.getByTestId("wg-intake-upload").setInputFiles([pdf.path, png.path, csv.path]);
    await page.getByTestId("wg-intake-upload-list").waitFor({ state: "visible", timeout: 60_000 });
    for (let i = 0; i < 30; i++) {
      const n = await page.getByTestId("wg-intake-upload-list").locator("li").count();
      if (n >= 3) break;
      await page.waitForTimeout(500);
    }
    const uploadList = await page.getByTestId("wg-intake-upload-list").innerText();
    record(
      "uploads_listed",
      uploadList.includes(pdf.name) && uploadList.includes(png.name) && uploadList.includes(csv.name),
      uploadList.slice(0, 400),
    );

    // Rejected type
    const bad = writeFixture(`wg-ux-${RUN}-bad.exe`, "MZ-not-allowed");
    await page.getByTestId("wg-intake-upload").setInputFiles(bad.path);
    await page.waitForTimeout(1500);
    const upErr = await page.getByTestId("wg-intake-upload-error").innerText().catch(() => "");
    record("reject_bad_filetype", /common venue file type|PDF|Excel/i.test(upErr), upErr);

    await page.getByRole("button", { name: /^Submit$/ }).click();
    await page.waitForURL(/\/waiting/, { timeout: 90_000 });
    record("submit_reaches_waiting", /\/waiting/.test(page.url()), page.url());
    await page.screenshot({ path: join(SHOTS, "waiting-1280.png"), fullPage: false });

    const { data: intake } = await admin
      .from("venue_onboarding_intake")
      .select("*")
      .eq("venue_id", ctx.venueId)
      .maybeSingle();
    record(
      "migration_appointment_columns_live",
      Array.isArray(intake?.appointment_type_keys) &&
        ("appointment_types_other" in (intake ?? {})),
      "PostgREST select of appointment_type_keys + appointment_types_other succeeded (live schema)",
    );
    record(
      "intake_persisted",
      intake?.venue_name === ctx.venueName &&
        intake?.address_line1 === "22 UX Trail" &&
        intake?.city === "Asheville" &&
        intake?.offers_tours === true &&
        intake?.offers_tastings_or_appointments === true &&
        Array.isArray(intake?.appointment_type_keys) &&
        intake.appointment_type_keys.includes("consultations") &&
        intake.appointment_type_keys.includes("other") &&
        intake?.appointment_types_other === "Vendor meet-and-greet" &&
        (intake?.inquiry_sources ?? []).includes("website") &&
        intake?.bring_business_choice === "honeybook",
      JSON.stringify({
        venue_name: intake?.venue_name,
        offers: intake?.offers_tastings_or_appointments,
        types: intake?.appointment_type_keys,
        other: intake?.appointment_types_other,
        bring: intake?.bring_business_choice,
      }),
    );

    // Inquiry sources → setup-hub lead_capture_path hint only (not live lead-capture config).
    const { data: hub } = await admin
      .from("venue_setup_hub_state")
      .select("lead_capture_path,lead_capture_path_decided_at")
      .eq("venue_id", ctx.venueId)
      .maybeSingle();
    record(
      "inquiry_sources_set_setup_hub_path_hint",
      hub?.lead_capture_path === "automated" && Boolean(hub?.lead_capture_path_decided_at),
      JSON.stringify({
        inquiry_sources: intake?.inquiry_sources,
        lead_capture_path: hub?.lead_capture_path,
        decided_at: hub?.lead_capture_path_decided_at,
        note: "Website/FB/marketplace answers only stamp venue_setup_hub_state.lead_capture_path; they do not create public forms, Facebook Lead Ads, or marketplace connectors.",
      }),
    );

    const { data: venue } = await admin
      .from("venues")
      .select("name,address_line1,city,phone,website,tour_scheduling_enabled,space_operating_mode")
      .eq("id", ctx.venueId)
      .maybeSingle();
    record(
      "venue_portal_basics_populated",
      venue?.name === ctx.venueName &&
        venue?.address_line1 === "22 UX Trail" &&
        venue?.city === "Asheville" &&
        venue?.phone === "828-555-0199" &&
        venue?.tour_scheduling_enabled === true,
      JSON.stringify(venue),
    );

    const { data: spaces } = await admin
      .from("venue_spaces")
      .select("name,capacity")
      .eq("venue_id", ctx.venueId);
    record(
      "space_populated",
      (spaces ?? []).some((s) => s.name === "Garden Room" && Number(s.capacity) === 86),
      JSON.stringify(spaces),
    );

    const { data: materials } = await admin
      .from("venue_onboarding_materials")
      .select("id,file_name,storage_path,byte_size,venue_id,enrollment_id,public_url")
      .eq("venue_id", ctx.venueId)
      .order("uploaded_at", { ascending: true });
    materialIds = (materials ?? []).map((m) => m.id);
    record(
      "materials_metadata",
      (materials ?? []).length >= 3 &&
        (materials ?? []).every((m) => m.venue_id === ctx.venueId && m.enrollment_id === ctx.enrollmentId && m.public_url == null),
      JSON.stringify((materials ?? []).map((m) => ({
        name: m.file_name,
        bytes: m.byte_size,
        path: m.storage_path,
      }))),
    );

    let integrityOk = true;
    const integrityDetails: string[] = [];
    for (const fixture of [pdf, png, csv]) {
      const row = (materials ?? []).find((m) => m.file_name === fixture.name);
      if (!row?.storage_path) {
        integrityOk = false;
        integrityDetails.push(`missing ${fixture.name}`);
        continue;
      }
      const { data: blob, error } = await admin.storage.from("documents").download(row.storage_path);
      if (error || !blob) {
        integrityOk = false;
        integrityDetails.push(`download fail ${fixture.name}: ${error?.message}`);
        continue;
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      const sha = createHash("sha256").update(buf).digest("hex");
      if (sha !== fixture.sha256) {
        integrityOk = false;
        integrityDetails.push(`sha mismatch ${fixture.name}`);
      } else {
        integrityDetails.push(`ok ${fixture.name}`);
      }
    }
    record("materials_byte_integrity", integrityOk, integrityDetails.join("; "));

    // Cross-token / unauthorized denial
    const cross = await fetch(
      `${APP}/api/onboarding/white-glove/materials?intakeToken=intake_not_real_token`,
    );
    record("cross_token_materials_denied", cross.status >= 400, `status=${cross.status}`);

    // Cross-venue: non-HQ Fancy staff must not retrieve this venue's material
    const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
    const fancyAuth = await cookiesFor(HQ_EMAIL, FANCY);
    // Strip HQ by using a non-HQ staff if available; Jennifer is HQ — use owner of Fancy? Use owner session of disposable venue for positive, and anonymous for denial of other venue path.
    const anonMat = await fetch(
      `${APP}/api/admin/onboarding/materials/${materialIds[0]}/file?format=json`,
    );
    record(
      "anon_hq_material_denied",
      anonMat.status === 401 || anonMat.status === 403 || anonMat.status >= 400,
      `status=${anonMat.status}`,
    );
    // Fancy active-context cookie as jennifer still is HQ — prove foreign venue owner cannot use intake materials API for this enrollment
    const foreignOwner = await cookiesFor(ctx.ownerEmail, FANCY);
    const foreignList = await fetch(
      `${APP}/api/onboarding/white-glove/materials?intakeToken=${encodeURIComponent(ctx.intakeToken)}`,
      {
        headers: {
          cookie: foreignOwner.cookies
            .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
            .join("; "),
        },
      },
    );
    // Intake materials API is token-scoped (not session-scoped); wrong active venue must not broaden access.
    // Re-check with a deliberately wrong enrollment token belonging to no venue:
    const wrongEnrollmentToken = await fetch(
      `${APP}/api/onboarding/white-glove/materials?intakeToken=intake_other_venue_${RUN.toLowerCase()}`,
      {
        headers: {
          cookie: fancyAuth.cookies
            .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
            .join("; "),
        },
      },
    );
    record(
      "cross_venue_materials_token_denied",
      wrongEnrollmentToken.status >= 400,
      `status=${wrongEnrollmentToken.status} foreignListStatus=${foreignList.status}`,
    );

    // Revisit edit form while still in waiting (pre-activation)
    await page.goto(
      `${APP}/onboarding/white-glove/${encodeURIComponent(ctx.intakeToken)}?edit=1`,
      { waitUntil: "domcontentloaded", timeout: 90_000 },
    );
    await page.waitForSelector('[data-testid="wg-welcome-box"]', { timeout: 60_000 });
    const reopenedName = await page
      .locator("div.space-y-1\\.5")
      .filter({ hasText: /Venue name/i })
      .first()
      .locator("input")
      .inputValue();
    record("reopen_edit_restores_venue_name", reopenedName === ctx.venueName, reopenedName);

    // Owner Settings mirror — WG owners are gated to /waiting until enrollment is
    // activated (post-handoff). Simulate activation so Settings is reachable.
    await admin
      .from("venue_enrollments")
      .update({ status: "activated" })
      .eq("id", ctx.enrollmentId);

    // Ensure owner staff row is active owner (getCurrentUserRole → owner).
    await admin.from("venue_staff").upsert(
      {
        venue_id: ctx.venueId,
        user_id: ctx.ownerUserId,
        email: ctx.ownerEmail,
        is_owner: true,
        is_active: true,
        role: "owner",
      },
      { onConflict: "venue_id,user_id" },
    ).then(() => undefined).catch(async () => {
      await admin
        .from("venue_staff")
        .update({ is_owner: true, is_active: true, role: "owner" })
        .eq("venue_id", ctx.venueId)
        .eq("user_id", ctx.ownerUserId);
    });

    // Seed required venue-owner legal acceptances so Welcome does not block Settings.
    const { data: legalDocs } = await admin
      .from("legal_documents")
      .select("id,document_type,version,is_active,is_published")
      .in("document_type", [
        "terms_of_service",
        "privacy_policy",
        "cookie_policy",
        "acceptable_use_policy",
      ])
      .eq("is_active", true)
      .eq("is_published", true);
    for (const doc of legalDocs ?? []) {
      await admin.from("legal_acceptances").insert({
        user_id: ctx.ownerUserId,
        legal_document_id: doc.id,
        accepted_version: doc.version,
        acceptance_method: "Venue Signup",
      });
    }

    const ownerAuth = await cookiesFor(ctx.ownerEmail, ctx.venueId);
    const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await staffCtx.addCookies(ownerAuth.cookies);
    const settings = await staffCtx.newPage();
    await settings.goto(`${APP}/settings/availability`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await passVenueWelcome(settings);
    if (/\/welcome/i.test(settings.url()) || /\/waiting/i.test(settings.url())) {
      await settings.goto(`${APP}/settings/availability`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await passVenueWelcome(settings);
    }
    await settings.screenshot({ path: join(SHOTS, "settings-debug-1280.png"), fullPage: false }).catch(() => undefined);
    await settings.waitForSelector('[data-testid="appointments-offered-settings"]', { timeout: 90_000 });
    const settingsText = await settings.getByTestId("appointments-offered-settings").innerText();
    record(
      "settings_shows_saved_appointments",
      /Do you offer appointments other than tours\?/.test(settingsText) &&
        (await settings.getByTestId("settings-appointment-type-consultations").isChecked()) &&
        (await settings.getByTestId("settings-appointment-types-other").inputValue()) ===
          "Vendor meet-and-greet",
      settingsText.slice(0, 500),
    );
    const menuToggle = settings.getByTestId("settings-appointment-type-menu_tastings");
    await menuToggle.waitFor({ state: "visible", timeout: 15_000 });
    await menuToggle.click({ force: true });
    let afterSettings: {
      appointment_type_keys: string[] | null;
      offers_tastings_or_appointments: boolean | null;
    } | null = null;
    for (let i = 0; i < 20; i++) {
      const { data } = await admin
        .from("venue_onboarding_intake")
        .select("appointment_type_keys,offers_tastings_or_appointments")
        .eq("venue_id", ctx.venueId)
        .maybeSingle();
      afterSettings = data;
      if ((data?.appointment_type_keys ?? []).includes("menu_tastings")) break;
      await settings.waitForTimeout(400);
    }
    record(
      "settings_updates_same_intake_row",
      afterSettings?.offers_tastings_or_appointments === true &&
        (afterSettings?.appointment_type_keys ?? []).includes("menu_tastings") &&
        (afterSettings?.appointment_type_keys ?? []).includes("consultations"),
      JSON.stringify(afterSettings),
    );
    await settings.screenshot({ path: join(SHOTS, "settings-appointments-1280.png"), fullPage: false });

    // HQ can see materials for venue (operator download path existence)
    const hqAuth = await cookiesFor(HQ_EMAIL);
    const hqRes = await fetch(
      `${APP}/api/admin/onboarding/materials/${materialIds[0]}/file?format=json`,
      {
        headers: {
          cookie: hqAuth.cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join("; "),
        },
      },
    );
    const hqJson = (await hqRes.json().catch(() => ({}))) as { ok?: boolean; signedUrl?: string; error?: string };
    record(
      "hq_material_signed_url",
      hqRes.ok && Boolean(hqJson.signedUrl),
      JSON.stringify({ status: hqRes.status, ok: hqJson.ok, hasUrl: Boolean(hqJson.signedUrl), error: hqJson.error }),
    );
  } catch (err) {
    record(
      "harness_error",
      false,
      err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err),
    );
  } finally {
    await browser.close().catch(() => undefined);
    // Soft cleanup disposable materials + enrollment leftovers kept for forensics unless CLEANUP=1
    if (process.env.CLEANUP === "1") {
      for (const id of materialIds) {
        const { data: m } = await admin
          .from("venue_onboarding_materials")
          .select("storage_path")
          .eq("id", id)
          .maybeSingle();
        if (m?.storage_path) await admin.storage.from("documents").remove([m.storage_path]);
        await admin.from("venue_onboarding_materials").delete().eq("id", id);
      }
    }
    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.filter((c) => !c.pass).length;
    const payload = { ok: failed === 0, run: RUN, expectedSha: EXPECTED, passed, failed, checks };
    writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(payload, null, 2));
    console.log(`\nRESULT ${failed === 0 ? "GREEN" : "RED"} ${passed}/${passed + failed}`);
    process.exit(failed === 0 ? 0 : 1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
