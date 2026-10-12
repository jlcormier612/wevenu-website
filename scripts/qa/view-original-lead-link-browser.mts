/**
 * Sandbox: after Booked, "View original lead" reaches the same lead record
 * with inquiry history intact. Disposable Fancy Venue only.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_PREFIX = process.env.EXPECTED_TIP_PREFIX ?? "";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/view-original-lead-link";
const EVENT_DATE = "2030-06-14";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
const createdLeadIds: string[] = [];

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(linkHeader: string | undefined) {
  const match = linkHeader?.match(/dpl=([0-9a-f]{40})/);
  return match?.[1] ?? null;
}

async function cookiesFor(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map(
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

async function cleanup() {
  for (const leadId of createdLeadIds) {
    const { data: clients } = await admin.from("clients").select("id").eq("lead_id", leadId).eq("venue_id", FANCY);
    for (const c of clients ?? []) {
      const { data: evs } = await admin.from("events").select("id").eq("client_id", c.id);
      for (const e of evs ?? []) {
        await admin.from("event_space_assignments").delete().eq("event_id", e.id);
        await admin.from("events").delete().eq("id", e.id);
      }
      await admin.from("clients").delete().eq("id", c.id);
    }
    await admin.from("date_holds").delete().eq("lead_id", leadId);
    await admin.from("lead_notes").delete().eq("lead_id", leadId).catch(() => undefined);
    await admin.from("leads").delete().eq("id", leadId);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = String(Date.now()).slice(-6);
  const inquiry = `[qa] original-lead-link disposable inquiry ${stamp}`;

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: "Orig",
      last_name: `Lead${stamp}`,
      email: `orig-lead-${stamp}@hellotocheers-test.invalid`,
      event_date: EVENT_DATE,
      event_type: "wedding",
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
      inquiry_message: inquiry,
      inquiry_message_origin: "customer",
    })
    .select("id, inquiry_message")
    .single();
  if (leadErr) throw leadErr;
  createdLeadIds.push(lead.id);

  // Optional internal note table may differ; try common shapes.
  await admin.from("lead_notes").insert({
    venue_id: FANCY,
    lead_id: lead.id,
    body: `Internal note for original lead ${stamp}`,
  }).then(() => undefined, () => undefined);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();

  try {
    const login = await page.goto(APP + "/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const serving = noteDeployment(login?.headers()["link"]);
    const tipOk = !EXPECTED_PREFIX || (!!serving && serving.startsWith(EXPECTED_PREFIX));
    record("serving_commit", tipOk, serving ?? "no dpl");
    if (!tipOk) throw new Error(`serving ${serving}, expected prefix ${EXPECTED_PREFIX}`);

    await page.goto(`${APP}/leads/${lead.id}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: "Change stage" }).waitFor({ state: "visible", timeout: 30_000 });
    const leadBody = await page.locator("body").innerText();
    record("pre_book_inquiry_visible", leadBody.includes(inquiry) || leadBody.includes("Orig"), leadBody.slice(0, 300));
    await page.screenshot({ path: `${OUT_DIR}/01-lead-before.png`, fullPage: true });

    await page.getByRole("button", { name: "Change stage" }).click();
    await page.getByRole("menuitem", { name: /^Booked/ }).click();
    const dialog = page.getByTestId("booking-confirmation");
    await dialog.waitFor({ timeout: 25_000 });
    // Wait for live draft if present
    await page.waitForTimeout(800);
    await page.getByTestId("booking-confirm-date").fill(EVENT_DATE);
    await page.getByTestId("booking-confirm-start").fill("10:00");
    await page.getByTestId("booking-confirm-end").fill("16:00");
    const reception = dialog.locator("#esa-reception");
    if (await reception.count()) {
      await reception.click();
      await page.getByRole("option", { name: /^Barn/ }).first().click();
      const date = dialog.getByTestId("esa-date-reception");
      if (await date.count()) await date.fill(EVENT_DATE);
      const start = dialog.locator("#esa-reception-start");
      const end = dialog.locator("#esa-reception-end");
      if (await start.count()) await start.fill("10:00");
      if (await end.count()) await end.fill("16:00");
    } else {
      // single-space venues
      const space = dialog.locator("#booking-confirm-space, [data-testid='booking-confirm-space']").first();
      if (await space.count()) {
        await space.click();
        await page.getByRole("option", { name: /^Barn/ }).first().click().catch(() => undefined);
      }
    }
    await page.getByTestId("booking-confirm-submit").click();
    await page.waitForURL(/\/clients\/.+\/booked|\/clients\/[^/]+$/, { timeout: 60_000 });

    const clients = await admin.from("clients").select("id, lead_id").eq("lead_id", lead.id).eq("venue_id", FANCY);
    const clientRows = clients.data ?? [];
    record("one_client_from_lead", clientRows.length === 1 && clientRows[0]!.lead_id === lead.id, JSON.stringify(clientRows));
    const clientId = clientRows[0]?.id;

    // Celebration (if still on /booked) or lasting workspace
    let onCelebration = /\/booked/.test(page.url());
    if (onCelebration) {
      const celebLink = page.getByTestId("view-original-lead");
      await celebLink.waitFor({ state: "visible", timeout: 15_000 });
      record("celebration_link_visible", await celebLink.isVisible(), await celebLink.innerText());
      await page.screenshot({ path: `${OUT_DIR}/02-celebration.png`, fullPage: true });
      await page.getByRole("link", { name: /Open Event/i }).click();
      await page.waitForURL(new RegExp(`/clients/${clientId}`), { timeout: 30_000 });
    }

    if (clientId && !page.url().includes(`/clients/${clientId}`)) {
      await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    }

    const workspaceLink = page.getByTestId("view-original-lead");
    await workspaceLink.waitFor({ state: "visible", timeout: 20_000 });
    const href = await workspaceLink.getAttribute("href");
    record(
      "workspace_link_canonical",
      href === `/leads/${lead.id}` && (await workspaceLink.innerText()).includes("View original lead"),
      `href=${href} text=${await workspaceLink.innerText()}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/03-booked-workspace.png`, fullPage: true });

    await workspaceLink.click();
    await page.waitForURL(new RegExp(`/leads/${lead.id}`), { timeout: 30_000 });
    const after = await page.locator("body").innerText();
    const { data: leadAfter } = await admin.from("leads").select("id, inquiry_message, sales_stage").eq("id", lead.id).single();
    record(
      "original_lead_opens",
      page.url().includes(`/leads/${lead.id}`) && leadAfter?.inquiry_message === inquiry,
      JSON.stringify({ url: page.url(), leadAfter }),
    );
    record(
      "inquiry_history_intact",
      leadAfter?.inquiry_message === inquiry && after.includes("Orig"),
      after.slice(0, 400),
    );
    await page.screenshot({ path: `${OUT_DIR}/04-original-lead.png`, fullPage: true });

    // Back to booked workspace
    if (clientId) {
      await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByTestId("view-original-lead").waitFor({ state: "visible", timeout: 20_000 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("view-original-lead").waitFor({ state: "visible", timeout: 20_000 });
      record("workspace_link_after_reload", true, page.url());
    }

    const { count: leadCount } = await admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("email", `orig-lead-${stamp}@hellotocheers-test.invalid`);
    record("no_duplicate_lead", leadCount === 1, `count=${leadCount}`);
  } finally {
    await browser.close();
    await cleanup();
  }

  const payload = {
    tipPrefix: EXPECTED_PREFIX,
    checks,
    pass: checks.every((c) => c.pass),
  };
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(payload, null, 2));
  console.log(payload.pass ? "ALL PASS" : "SOME FAILED");
  process.exit(payload.pass ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  writeFileSync(
    `${OUT_DIR}/browser-results.json`,
    JSON.stringify({ tipPrefix: EXPECTED_PREFIX, checks, pass: false, error: String(err) }, null, 2),
  );
  await cleanup().catch(() => undefined);
  process.exit(1);
});
