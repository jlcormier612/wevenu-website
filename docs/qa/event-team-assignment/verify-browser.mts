/**
 * Team Assignment — Event owner only (Additional team members removed).
 * Mutates owner on a Sandbox demo event; restores after. Does not touch event_team rows.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
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
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/event-team-assignment";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 450)}`);
}

async function servingImage(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function servingDigest(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (error || !otp.session) throw error ?? new Error("no session");
  const session = otp.session;
  const cookieName = `sb-wvpsldwwjqdannqasrdf-auth-token`;
  const value = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });
  const chunks = ssrUtils.createChunks(cookieName, ssrUtils.stringToBase64URL(value));
  return [
    ...chunks.map((c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id",
      value: FANCY,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  const digest = await servingDigest();
  record("serving-sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED.slice(0, 12)} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image, digest, expected: EXPECTED }, null, 2));
    process.exit(1);
  }
  record("serving-digest-present", digest.startsWith("sha256:"), digest);

  const { data: eventBefore } = await admin
    .from("events")
    .select("id, status, booked_at, client_id, assigned_staff_id, venue_id")
    .eq("id", EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  record("fixture-event", Boolean(eventBefore?.client_id && eventBefore.booked_at), JSON.stringify(eventBefore));
  if (!eventBefore?.client_id) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image, digest }, null, 2));
    process.exit(1);
  }
  const clientId = eventBefore.client_id as string;
  const ownerBefore = (eventBefore.assigned_staff_id as string | null) ?? null;
  const statusBefore = eventBefore.status;
  const bookedAtBefore = eventBefore.booked_at;

  const { data: teamBefore } = await admin
    .from("event_team")
    .select("id, full_name, role, phone")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .order("created_at", { ascending: true });

  const { data: venueStaff } = await admin
    .from("venue_staff")
    .select("id, full_name, is_active")
    .eq("venue_id", FANCY)
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  const staff = (venueStaff ?? [])
    .map((s) => ({ id: s.id as string, name: (s.full_name as string) ?? "" }))
    .filter((s) => s.name.trim());
  record("venue-staff-count", staff.length >= 2, `n=${staff.length}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("pageerror", (err: Error) => consoleErrors.push(String(err).slice(0, 300)));
  page.on("response", (res: { status: () => number; url: () => string }) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`.slice(0, 300));
  });

  const workspaceUrl = `${APP}/clients/${clientId}`;
  await page.goto(workspaceUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector('[data-testid="event-staff-assignment"]', { timeout: 60_000 });
  await page.waitForTimeout(800);

  const band = page.getByTestId("event-staff-assignment");
  const row = page.getByTestId("event-team-assignment-row");
  record("team-band-visible", await band.isVisible(), "event-staff-assignment");
  record("team-row-visible", await row.isVisible(), "event-team-assignment-row");
  record("owner-field", await page.getByTestId("event-owner-assignment").isVisible(), "present");
  record(
    "no-additional-team-members-label",
    (await page.getByText("Additional team members", { exact: true }).count()) === 0,
    "removed",
  );
  record(
    "no-additional-event-staff-heading",
    (await page.getByText("Additional event staff", { exact: true }).count()) === 0,
    "removed",
  );
  record(
    "no-additional-select",
    (await page.getByTestId("event-team-add-select").count()) === 0,
    "removed",
  );
  record(
    "no-event-team-section",
    (await page.getByTestId("event-team-section").count()) === 0,
    "removed",
  );

  const bandBox = await band.boundingBox();
  const ownerBox = await page.getByTestId("event-owner-assignment").boundingBox();
  record(
    "owner-fully-inside-band",
    Boolean(
      bandBox &&
        ownerBox &&
        ownerBox.x >= bandBox.x - 1 &&
        ownerBox.y >= bandBox.y - 1 &&
        ownerBox.x + ownerBox.width <= bandBox.x + bandBox.width + 1 &&
        ownerBox.y + ownerBox.height <= bandBox.y + bandBox.height + 1,
    ),
    JSON.stringify({ bandBox, ownerBox }),
  );
  record(
    "desktop-no-h-overflow",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    "scrollWidth vs innerWidth",
  );

  const qCard = page.getByTestId("event-questionnaires-card");
  record("questionnaires-card", await qCard.isVisible(), "present");
  const qText = await qCard.innerText();
  record(
    "questionnaires-copy",
    /Schedule them or send now — your choice!/.test(qText.replace(/\s+/g, " ")),
    qText.slice(0, 200),
  );

  await page.screenshot({ path: `${OUT}/shots/desktop-1280.png`, fullPage: false });

  const alternateOwner = staff.find((s) => s.id !== ownerBefore) ?? staff[0];
  const restoreOwner = ownerBefore;
  record("alternate-owner-available", Boolean(alternateOwner), alternateOwner?.name ?? "none");

  if (alternateOwner) {
    const ownerField = page.getByTestId("event-owner-assignment");
    await ownerField.getByRole("combobox").click();
    await page.waitForTimeout(300);
    const ownerOption = page.getByRole("option", { name: alternateOwner.name, exact: true });
    record("owner-option-visible", (await ownerOption.count()) > 0, alternateOwner.name);
    if ((await ownerOption.count()) > 0) {
      await ownerOption.first().click();
      await page.keyboard.press("Escape");
      await page.getByTestId("event-owner-assignment-save").click();
      await page
        .getByText(/Assignment saved|Could not save/i)
        .first()
        .waitFor({ timeout: 15_000 })
        .catch(() => undefined);
      await page.waitForTimeout(500);
      const { data: afterOwner } = await admin
        .from("events")
        .select("assigned_staff_id, status, booked_at")
        .eq("id", EVENT)
        .maybeSingle();
      record(
        "owner-persisted",
        afterOwner?.assigned_staff_id === alternateOwner.id,
        `want=${alternateOwner.id} got=${afterOwner?.assigned_staff_id}`,
      );
      record(
        "booking-unchanged-after-owner",
        afterOwner?.status === statusBefore && afterOwner?.booked_at === bookedAtBefore,
        JSON.stringify({ status: afterOwner?.status, booked_at: afterOwner?.booked_at }),
      );

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector('[data-testid="event-owner-assignment"]', { timeout: 60_000 });
      const ownerLabel = await page.getByTestId("event-owner-assignment").innerText();
      record("owner-ui-matches-db", ownerLabel.includes(alternateOwner.name), ownerLabel.slice(0, 180));
    }
  }

  // Restore owner
  if (restoreOwner !== undefined) {
    const { data: current } = await admin
      .from("events")
      .select("assigned_staff_id")
      .eq("id", EVENT)
      .maybeSingle();
    if ((current?.assigned_staff_id ?? null) !== restoreOwner) {
      await admin
        .from("events")
        .update({ assigned_staff_id: restoreOwner })
        .eq("id", EVENT)
        .eq("venue_id", FANCY);
    }
  }

  const { data: teamFinal } = await admin
    .from("event_team")
    .select("id, full_name, role, phone")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .order("created_at", { ascending: true });
  const beforeIds = new Set((teamBefore ?? []).map((r) => r.id));
  const finalIds = new Set((teamFinal ?? []).map((r) => r.id));
  const sameTeam =
    beforeIds.size === finalIds.size && [...beforeIds].every((id) => finalIds.has(id as string));
  const samePayload = JSON.stringify(teamBefore ?? []) === JSON.stringify(teamFinal ?? []);
  record("event-team-rows-unchanged", sameTeam && samePayload, JSON.stringify({ before: teamBefore, final: teamFinal }));

  const { data: eventRestored } = await admin
    .from("events")
    .select("assigned_staff_id, status, booked_at")
    .eq("id", EVENT)
    .maybeSingle();
  record(
    "owner-restored",
    (eventRestored?.assigned_staff_id ?? null) === restoreOwner,
    `want=${restoreOwner} got=${eventRestored?.assigned_staff_id}`,
  );
  record(
    "booking-final-unchanged",
    eventRestored?.status === statusBefore && eventRestored?.booked_at === bookedAtBefore,
    JSON.stringify(eventRestored),
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(workspaceUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector('[data-testid="event-staff-assignment"]', { timeout: 60_000 });
  await page.waitForTimeout(600);
  const narrowBand = page.getByTestId("event-staff-assignment");
  const narrowOwner = page.getByTestId("event-owner-assignment");
  const nb = await narrowBand.boundingBox();
  const no = await narrowOwner.boundingBox();
  record("narrow-band-visible", await narrowBand.isVisible(), "390");
  record(
    "narrow-owner-fully-inside-band",
    Boolean(
      nb &&
        no &&
        no.x >= nb.x - 1 &&
        no.y >= nb.y - 1 &&
        no.x + no.width <= nb.x + nb.width + 1 &&
        no.y + no.height <= nb.y + nb.height + 1,
    ),
    JSON.stringify({ nb, no }),
  );
  record(
    "narrow-no-h-overflow",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    "390 scrollWidth",
  );
  record(
    "narrow-no-additional-label",
    (await page.getByText("Additional team members", { exact: true }).count()) === 0,
    "390",
  );
  await page.screenshot({ path: `${OUT}/shots/narrow-390.png`, fullPage: false });

  record("no-page-errors", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" || ") || "none");
  record(
    "no-failed-requests",
    failedRequests.length === 0,
    failedRequests.slice(0, 5).join(" || ") || "none",
  );

  await browser.close();

  const persisted = {
    expectedSha: EXPECTED,
    image,
    digest,
    eventId: EVENT,
    clientId,
    before: {
      assigned_staff_id: ownerBefore,
      status: statusBefore,
      booked_at: bookedAtBefore,
      team: teamBefore,
    },
    afterRestore: {
      assigned_staff_id: eventRestored?.assigned_staff_id ?? null,
      status: eventRestored?.status,
      booked_at: eventRestored?.booked_at,
      team: teamFinal,
    },
  };
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));

  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ pass: failed === 0, failed, total: checks.length, checks, image, digest }, null, 2),
  );
  console.log(`\n${failed === 0 ? "GREEN" : "NOT GREEN"} ${checks.length - failed}/${checks.length} pass`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
