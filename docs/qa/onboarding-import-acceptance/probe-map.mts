import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const APP = "https://app.sandbox.hellotocheers.com";

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const stamp = Date.now();
  const email = `jennifer+obprobe.${stamp}@hellotocheers.com`;
  const password = `Ob-${stamp}-Aa1x`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr || !created.user) throw cErr ?? new Error("user");
  const userId = created.user.id;
  const { data: venue, error: vErr } = await admin
    .from("venues")
    .insert({ owner_user_id: userId, name: `Probe ${stamp}`, email: `v.${email}` })
    .select("id,name")
    .single();
  if (vErr || !venue) throw vErr ?? new Error("venue");
  await admin.from("venue_staff").insert({
    venue_id: venue.id,
    user_id: userId,
    full_name: "Probe",
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
  await admin.from("venue_staff_active_context").upsert({
    user_id: userId,
    active_venue_id: venue.id,
    updated_at: new Date().toISOString(),
  });
  await admin.from("venue_onboarding_intake").upsert(
    {
      venue_id: venue.id,
      path: "self_setup",
      venue_name: venue.name,
      space_mode: "one",
      spaces: [{ name: "Main Space", maxCapacity: null }],
      offers_tours: true,
      inquiry_sources: [],
      bring_business_choice: "another_system",
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "venue_id" },
  );
  await admin.from("venue_spaces").insert({ venue_id: venue.id, name: "Main Space", is_active: true, sort_order: 0 });
  await admin.from("venue_capacity_rules").upsert(
    { venue_id: venue.id, max_simultaneous_events: 1, max_simultaneous_tours: 2, min_turnaround_hours: 0 },
    { onConflict: "venue_id" },
  );
  await admin.from("venue_setup_hub_state").upsert(
    { venue_id: venue.id, onboarding_type: "self_setup" },
    { onConflict: "venue_id", ignoreDuplicates: true },
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  for (let i = 0; i < 60 && page.url().includes("/login"); i++) await page.waitForTimeout(400);

  await page.goto(`${APP}/settings/migration?source=another_system`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const another = page.getByText("Another system", { exact: true });
  if ((await another.count()) > 0) await another.first().click();
  await page.waitForTimeout(400);
  await page.locator("button[role=combobox]").first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: /Clients \(booked couples\)/i }).first().click();
  await page.waitForTimeout(500);
  await page
    .locator('input[type="file"][accept=".csv"]')
    .setInputFiles(resolve("docs/qa/onboarding-import-acceptance/fixtures/another-system-imperfect.csv"));
  await page.waitForTimeout(3000);

  const selects = await page.locator("[role=combobox]").allInnerTexts();
  console.log("SELECTS:", JSON.stringify(selects, null, 2));
  const body = await page.locator("main").innerText();
  const idx = body.indexOf("First name");
  console.log("AROUND FIRST NAME:\n", body.slice(Math.max(0, idx), idx + 900));
  await page.screenshot({
    path: "docs/qa/onboarding-import-acceptance/shots/probe-another-map.png",
    fullPage: true,
  });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
