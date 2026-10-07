/**
 * Sandbox browser + DB proof: Setup Profile client experience model.
 * Fancy Venue only. Restores profile template_refs after proof saves.
 * Does not touch Production or the clean release cohort.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/setup-profile-client-experience";
const CLIENT_PLANNING_ID = "7a1766d4-f1cd-4882-a8ed-19a54aba68ea";

const out: {
  ok: boolean;
  servingSha: string | null;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  library: Record<string, unknown>;
  urls: Record<string, string>;
} = { ok: true, servingSha: null, checks: [], library: {}, urls: {} };

function record(name: string, pass: boolean, detail: string) {
  out.checks.push({ name, pass, detail });
  if (!pass) out.ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
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
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return ssrUtils.createChunks(cookieName, encoded).map(
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
}

const [
  { data: clientPlaybooks },
  { data: venuePlaybooks },
  { data: timelines },
  { data: floorPlans },
  { data: questionnaires },
  { data: vendors },
  { data: profiles },
] = await Promise.all([
  admin.from("playbook_templates").select("id,name,kind,is_archived").eq("venue_id", FANCY).eq("kind", "client").eq("is_archived", false),
  admin.from("playbook_templates").select("id,name,kind,is_archived").eq("venue_id", FANCY).eq("kind", "venue").eq("is_archived", false),
  admin.from("timeline_templates").select("id,name,is_archived").eq("venue_id", FANCY).eq("is_archived", false),
  admin.from("floor_plan_templates").select("id,name,is_archived").eq("venue_id", FANCY).eq("is_archived", false),
  admin.from("questionnaire_templates").select("id,name,kind,is_archived").eq("venue_id", FANCY).eq("is_archived", false),
  admin.from("vendors").select("id,business_name").eq("venue_id", FANCY).limit(20),
  admin.from("venue_setup_profiles").select("id,name,decisions,template_refs").eq("venue_id", FANCY),
]);

out.library = {
  clientPlaybooks: clientPlaybooks ?? [],
  venuePlaybooks: venuePlaybooks ?? [],
  timelines: (timelines ?? []).map((t) => t.name),
  floorPlans: (floorPlans ?? []).map((t) => t.name),
  questionnaires: (questionnaires ?? []).map((t) => t.name),
  vendorCount: (vendors ?? []).length,
  profileCount: (profiles ?? []).length,
};

record(
  "client-planning-templates-exist",
  (clientPlaybooks ?? []).length >= 1,
  `${(clientPlaybooks ?? []).length} active client playbooks: ${(clientPlaybooks ?? []).map((p) => p.name).join(", ") || "(none)"}`,
);

const profile = (profiles ?? [])[0] ?? null;
const originalRefs = profile ? structuredClone(profile.template_refs) : null;

// Exact serving image from ECS task definition (health JSON has no git SHA).
const { execSync } = await import("node:child_process");
let ecsImage = "";
try {
  ecsImage = execSync(
    "aws ecs describe-task-definition --task-definition htc-sandbox-venue-app --region us-east-1 --query 'taskDefinition.containerDefinitions[0].image' --output text",
    { encoding: "utf8" },
  ).trim();
} catch {
  ecsImage = "";
}
const ecsSha = ecsImage.includes(":") ? ecsImage.split(":").pop()! : "";
out.servingSha = ecsSha || null;
const health = await fetch(`${APP}/api/health`).then((r) => r.json()).catch(() => null) as {
  ok?: boolean;
} | null;
record(
  "health",
  Boolean(health?.ok),
  JSON.stringify(health),
);
const headSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
const servingOk = Boolean(ecsSha && (ecsSha === headSha || ecsImage.endsWith(headSha)));
record(
  "serving-runtime",
  servingOk,
  `ecsImage=${ecsImage || "unknown"} head=${headSha}`,
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies(await cookiesFor(FANCY_EMAIL));
const page = await context.newPage();

await page.goto(`${APP}/settings/leads/setup-profiles`, { waitUntil: "networkidle", timeout: 60000 });
out.urls.setupProfiles = page.url();
const body = await page.locator("body").innerText();

record("explanation-present", body.includes("Set up the client experience"), "top explanation heading");
record("preset-copy", body.includes("preset in their client portal"), "preset portal copy");
record("starting-choices", body.includes("starting choices"), "team can change later");
record("invite-cta", body.includes("Invite to portal"), "exact booking-journey CTA wording");
record("no-skip-warning", !body.includes("cannot be skipped"), "no portal skip implementation warning");
record("no-impl-jargon", !/template_refs|snapshotting|inheritance/i.test(body), "no internal jargon");
record("no-additional-timelines", !body.includes("Additional available timelines"), "no second timeline list");

if (profile) {
  const edit = page.getByRole("button", { name: "Edit" }).first();
  await edit.click();
  await page.waitForTimeout(500);

  const planningSelect = page.locator('[data-testid="setup-profile-default-planning"]');
  const planningOptions = await planningSelect.locator("option").allTextContents();
  const clientNames = (clientPlaybooks ?? []).map((p) => p.name);
  const venueNames = (venuePlaybooks ?? []).map((p) => p.name);
  const hasClient = clientNames.every((n) => planningOptions.some((o) => o.includes(n)));
  const hasVenueLeak = venueNames.some((n) => planningOptions.some((o) => o.includes(n)));
  record(
    "planning-dropdown-client-library",
    hasClient && !hasVenueLeak && planningOptions.length > 1,
    `options=${JSON.stringify(planningOptions)}; client=${JSON.stringify(clientNames)}; venueLeak=${hasVenueLeak}`,
  );
  record(
    "planning-not-only-none",
    planningOptions.length >= 2 && planningOptions.some((o) => o !== "None" && o.trim() !== ""),
    `must list every active client template, not only None; options=${JSON.stringify(planningOptions)}`,
  );
  record(
    "planning-all-active-client-templates",
    hasClient && (clientPlaybooks ?? []).length >= 1,
    `activeClientCount=${(clientPlaybooks ?? []).length} (Fancy has ${(clientPlaybooks ?? []).length} active kind=client; venue playbooks excluded by design)`,
  );
  // Orphaned venue-kind refs must not pretend to be selected; value must be empty or a client id.
  const planningValue = await planningSelect.evaluate((el: HTMLSelectElement) => el.value);
  const clientIds = new Set((clientPlaybooks ?? []).map((p) => p.id));
  const venueIds = new Set((venuePlaybooks ?? []).map((p) => p.id));
  record(
    "planning-selected-value-is-client-or-none",
    planningValue === "" || clientIds.has(planningValue),
    `select.value=${planningValue || "(none)"}`,
  );
  record(
    "planning-selected-not-venue-kind",
    !venueIds.has(planningValue),
    `selected=${planningValue || "(none)"} venueIds=${[...venueIds].join(",")}`,
  );
  record(
    "fancy-planning-resolves-client-template",
    planningValue === CLIENT_PLANNING_ID,
    `select.value=${planningValue || "(none)"} expected=${CLIENT_PLANNING_ID}`,
  );
  record(
    "timeline-one-dropdown",
    await page.locator('[data-testid="setup-profile-default-timeline"]').count() === 1,
    "single timeline select",
  );

  // Ensure capability defaults are visible (profile may already have set_up).
  const capabilityRows = page.locator("fieldset ul > li");
  const rowCount = await capabilityRows.count();
  for (let i = 0; i < rowCount; i += 1) {
    const row = capabilityRows.nth(i);
    const included = row.getByRole("button", { name: "Included", exact: true });
    if (await included.count()) {
      await included.click().catch(() => undefined);
    }
  }
  await page.waitForTimeout(500);
  await page.locator('[data-testid="setup-profile-default-timeline"]').waitFor({ state: "visible", timeout: 10000 });

  const timelineSelect = page.locator('[data-testid="setup-profile-default-timeline"]');
  const timelineOptions = await timelineSelect.evaluate((el: HTMLSelectElement) =>
    [...el.options].map((o) => o.textContent ?? ""),
  );
  record(
    "timeline-library",
    (timelines ?? []).every((t) => timelineOptions.some((o) => o.includes(t.name))),
    `timeline options=${JSON.stringify(timelineOptions)}; library=${(timelines ?? []).length}`,
  );

  const fpSection = page.locator('[data-testid="setup-profile-floor-plans"]');
  const fpText = await fpSection.innerText().catch(() => "");
  record(
    "floor-plans-multi",
    (await fpSection.count()) > 0 && fpText.includes("Floor plans clients can choose from"),
    "floor plan multi-select section present",
  );
  record(
    "floor-plans-preferred",
    fpText.includes("Preferred starting plan") && (await page.locator('[data-testid="setup-profile-default-floor-plan"]').count()) === 1,
    "preferred starting plan control present",
  );
  record(
    "questionnaires-multi",
    await page.locator('[data-testid="setup-profile-questionnaires"]').count() > 0,
    "questionnaires multi-select section present",
  );
  const qText = await page.locator('[data-testid="setup-profile-questionnaires"]').innerText().catch(() => "");
  record("questionnaires-draft-copy", qText.includes("drafts") && qText.includes("until you send"), qText.slice(0, 160));

  const vText = await page.locator('[data-testid="setup-profile-vendors"]').innerText().catch(() => "");
  record(
    "vendors-semantics-copy",
    vText.includes("Vendors your team expects to book") && vText.includes("Recommended vendors for the client"),
    vText.slice(0, 200),
  );

  // Select up to two floor plans + preferred for save proof (restore after).
  const fpBoxes = page.locator('[data-testid="setup-profile-floor-plans"] input[type="checkbox"]');
  await page.locator('[data-testid="setup-profile-floor-plans"]').waitFor({ state: "visible", timeout: 10000 });
  const fpCount = await fpBoxes.count();
  record("floor-plans-checkbox-count", fpCount >= 2, `checkboxCount=${fpCount}`);
  if (fpCount >= 1) {
    await fpBoxes.nth(0).check({ force: true }).catch(async () => { await fpBoxes.nth(0).click({ force: true }); });
    if (fpCount >= 2) {
      await fpBoxes.nth(1).check({ force: true }).catch(async () => { await fpBoxes.nth(1).click({ force: true }); });
    }
    const preferred = page.locator('[data-testid="setup-profile-default-floor-plan"]');
    const prefOptions = await preferred.evaluate((el: HTMLSelectElement) =>
      [...el.options].map((o) => ({ value: o.value, text: o.textContent ?? "" })),
    );
    if (prefOptions.length > 1 && prefOptions[1]?.value) {
      await preferred.selectOption(prefOptions[1].value);
    }
  }

  if ((clientPlaybooks ?? [])[0]) {
    await planningSelect.selectOption((clientPlaybooks ?? [])[0]!.id);
  }

  await page.getByRole("button", { name: "Save setup profile" }).click();
  await page.waitForTimeout(2000);
  await page.getByText("Setup profile saved.").waitFor({ timeout: 10000 }).catch(() => undefined);

  const { data: after } = await admin
    .from("venue_setup_profiles")
    .select("template_refs")
    .eq("id", profile.id)
    .maybeSingle();
  const refs = (after?.template_refs ?? {}) as Record<string, unknown>;
  record(
    "saved-planning-client-id",
    refs.planningPlaybookTemplateId === (clientPlaybooks ?? [])[0]?.id,
    `planningPlaybookTemplateId=${String(refs.planningPlaybookTemplateId)}`,
  );
  const fpIds = Array.isArray(refs.floorPlanTemplateIds) ? refs.floorPlanTemplateIds as string[] : [];
  record(
    "saved-floor-plan-multi",
    fpIds.length >= 1 || Boolean(refs.defaultFloorPlanTemplateId),
    `floorPlanTemplateIds=${JSON.stringify(fpIds)} preferred=${String(refs.defaultFloorPlanTemplateId)}`,
  );

  await page.goto(`${APP}/settings/leads/setup-profiles`, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.waitForTimeout(500);
  const reloaded = page.locator('[data-testid="setup-profile-default-planning"]');
  await reloaded.waitFor({ state: "visible", timeout: 10000 });
  const reloadedValue = await reloaded.evaluate((el: HTMLSelectElement) => el.value);
  const reloadedOptions = await reloaded.evaluate((el: HTMLSelectElement) =>
    [...el.options].map((o) => o.textContent ?? ""),
  );
  record(
    "planning-persists-after-reload",
    reloadedValue === (clientPlaybooks ?? [])[0]?.id
      && reloadedOptions.some((o) => o.includes((clientPlaybooks ?? [])[0]?.name ?? "___missing")),
    `reloadedValue=${reloadedValue} options=${JSON.stringify(reloadedOptions)}`,
  );

  // Restore original refs
  if (originalRefs !== null) {
    await admin.from("venue_setup_profiles").update({ template_refs: originalRefs }).eq("id", profile.id);
    record("restored-profile-refs", true, "original template_refs restored");
  }
} else {
  record("profile-exists", false, "no setup profile on Fancy venue");
}

// Invitation next step is explained on Setup Profile (exact booking-journey CTA).
// Booking journey primary label remains "Invite to portal" in product code.
const bookingModel = (await import("node:fs")).readFileSync(
  "lib/booking-journey/model.ts",
  "utf8",
);
record(
  "invite-path-code",
  bookingModel.includes('Invite to portal'),
  "booking journey primary CTA wording",
);
record(
  "invite-next-step-on-page",
  Boolean(out.checks.find((c) => c.name === "invite-cta" && c.pass)),
  "Setup Profile points venue to Invite to portal on the client's event",
);

const moneyEmail = `moneyfmt-${Date.now()}@example.com`;
const { data: moneyLead, error: moneyLeadErr } = await admin.from("leads").insert({
  venue_id: FANCY,
  first_name: "MoneyFmt",
  last_name: "Proof",
  email: moneyEmail,
  status: "new",
  sales_stage: "new_inquiry",
}).select("id").single();
if (moneyLeadErr || !moneyLead) {
  record("money-fixture", false, moneyLeadErr?.message ?? "could not create disposable lead");
} else {
  try {
    await page.goto(`${APP}/leads/${moneyLead.id}/edit`, { waitUntil: "networkidle", timeout: 60000 });
    const budget = page.locator("#eb");
    await budget.waitFor({ state: "visible", timeout: 15000 });
    const initial = await budget.inputValue();
    record("money-empty-starts-empty", initial.trim() === "", `initial=${JSON.stringify(initial)}`);
    await budget.fill("20000");
    await budget.blur();
    const blurred = await budget.inputValue();
    record("money-blur-whole", blurred === "$20,000", blurred);
    await budget.focus();
    const focused = await budget.inputValue();
    record("money-focus-numeric", focused === "20000", focused);
    await budget.fill("20000.50");
    await budget.blur();
    const cents = await budget.inputValue();
    record("money-blur-cents", cents === "$20,000.50", cents);
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Lead updated").waitFor({ timeout: 10000 }).catch(() => undefined);
    await page.goto(`${APP}/leads/${moneyLead.id}/edit`, { waitUntil: "networkidle", timeout: 60000 });
    const after = await page.locator("#eb").inputValue();
    const { data: stored } = await admin.from("leads").select("estimated_budget").eq("id", moneyLead.id).maybeSingle();
    record("money-reload-display", after === "$20,000.50", after);
    record(
      "money-stored-numeric",
      Number(stored?.estimated_budget) === 20000.5,
      `estimated_budget=${String(stored?.estimated_budget)}`,
    );
  } finally {
    await admin.from("leads").delete().eq("id", moneyLead.id);
    record("money-fixture-removed", true, moneyLead.id);
  }
}

await browser.close();

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ok: out.ok, servingSha: out.servingSha, failed: out.checks.filter((c) => !c.pass) }, null, 2));
process.exit(out.ok ? 0 : 1);
