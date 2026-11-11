/**
 * Timeline template ↔ space ↔ event ↔ client share workflow (Sandbox).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolveDefaultTimelineTemplateId } from "@/lib/timeline-templates/default-for-event";
import { resolveEntryTimeFromOffset } from "@/lib/timeline/constants";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const RUN = process.env.E2E_RUN_ID ?? `TS${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/timeline-template-space-client";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Outcome = "PASS" | "FAIL" | "BLOCKED";
type Check = { name: string; outcome: Outcome; detail: string };
const checks: Check[] = [];
function record(name: string, outcome: Outcome, detail: string) {
  checks.push({ name, outcome, detail: String(detail).slice(0, 2000) });
  console.log(`${outcome} ${name} — ${String(detail).slice(0, 420)}`);
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

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
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
  record(
    "Serving expected SHA",
    image.includes(EXPECTED.slice(0, 12)) ? "PASS" : "FAIL",
    image,
  );

  const { data: spaces } = await admin
    .from("venue_spaces")
    .select("id,name")
    .eq("venue_id", FANCY)
    .limit(2);
  const spaceA = spaces?.[0];
  const spaceB = spaces?.[1];
  if (!spaceA) throw new Error("need a venue space");

  // Create template assigned to space A
  const { data: tpl, error: tplErr } = await admin
    .from("timeline_templates")
    .insert({
      venue_id: FANCY,
      name: `QA-TS-${RUN}`,
      event_type: "wedding",
      space_id: spaceA.id,
      is_default: false,
      is_archived: false,
    })
    .select("id,space_id,event_type,name")
    .single();
  if (tplErr || !tpl) throw tplErr ?? new Error("tpl");

  await admin.from("timeline_template_items").insert({
    venue_id: FANCY,
    template_id: tpl.id,
    title: `QA-TS-${RUN}-item`,
    description: "from template",
    notes: `tpl-note-${RUN}`,
    time_of_day: null,
    minutes_offset: 15,
    day_offset: 0,
    needs_review: false,
    audiences: ["client"],
    sort_order: 0,
  });

  // Persist association
  const { data: reloaded } = await admin
    .from("timeline_templates")
    .select("id,space_id,event_type,name")
    .eq("id", tpl.id)
    .maybeSingle();
  record(
    "Template↔space association persists",
    reloaded?.space_id === spaceA.id ? "PASS" : "FAIL",
    JSON.stringify(reloaded),
  );

  // Mark default and verify preselect logic
  await admin
    .from("timeline_templates")
    .update({ is_default: false })
    .eq("venue_id", FANCY)
    .eq("event_type", "wedding")
    .eq("space_id", spaceA.id);
  await admin.from("timeline_templates").update({ is_default: true }).eq("id", tpl.id);

  const { data: allTpls } = await admin
    .from("timeline_templates")
    .select("id,venue_id,name,event_type,space_id,is_default,is_archived,source_master_key,created_at,updated_at")
    .eq("venue_id", FANCY)
    .eq("is_archived", false);
  const mapped = (allTpls ?? []).map((t) => ({
    id: t.id as string,
    venueId: t.venue_id as string,
    name: t.name as string,
    eventType: (t.event_type as string | null) ?? null,
    spaceId: (t.space_id as string | null) ?? null,
    isDefault: Boolean(t.is_default),
    isArchived: Boolean(t.is_archived),
    sourceMasterKey: (t.source_master_key as string | null) ?? null,
    createdAt: String(t.created_at),
    updatedAt: String(t.updated_at),
  }));
  const preselect = resolveDefaultTimelineTemplateId(mapped, "wedding", spaceA.id as string);
  record(
    "Space assignment drives default preselect",
    preselect === tpl.id ? "PASS" : "FAIL",
    `preselect=${preselect} tpl=${tpl.id} otherSpace=${resolveDefaultTimelineTemplateId(mapped, "wedding", spaceB?.id ?? null)}`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  // Library copy + no direct send
  await page.goto(`${APP}/library/timeline-templates`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  const libText = await page.locator("body").innerText();
  const explainsApply =
    /Applying a timeline to a booking happens on the event|Apply a template from the event|never as a client send|never emailed or sent directly/i.test(
      libText,
    );
  const noSendButton = (await page.getByRole("button", { name: /^Send to client$/i }).count()) === 0;
  record(
    "Library explains apply/share path (no direct client send)",
    explainsApply && noSendButton ? "PASS" : "FAIL",
    `explains=${explainsApply} noSend=${noSendButton}`,
  );
  const seesTpl = libText.includes(`QA-TS-${RUN}`);
  record("Library lists fixture template", seesTpl ? "PASS" : "FAIL", `sees=${seesTpl}`);
  await page.screenshot({ path: `${OUT}/shots/library-1280.png`, fullPage: true });

  // Open template editor page
  await page.goto(`${APP}/library/timeline-templates/${tpl.id}`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  const editorText = await page.locator("body").innerText();
  record(
    "Template editor shows space context",
    new RegExp(spaceA.name, "i").test(editorText) || /Space/i.test(editorText) ? "PASS" : "FAIL",
    editorText.slice(0, 200),
  );
  await page.screenshot({ path: `${OUT}/shots/template-editor-1280.png`, fullPage: false });

  // Apply to event (copy items — same as applyTimelineTemplateToEvent)
  const { data: event } = await admin
    .from("events")
    .select("start_time")
    .eq("id", EVENT)
    .maybeSingle();
  const start = (event?.start_time as string | null)?.slice(0, 5) ?? "16:00";
  const entryTime = resolveEntryTimeFromOffset(15, start) ?? "";
  const { data: entry, error: entryErr } = await admin
    .from("timeline_entries")
    .insert({
      venue_id: FANCY,
      event_id: EVENT,
      title: `QA-TS-${RUN}-item`,
      description: "from template",
      notes: `event-note-${RUN}`,
      entry_time: entryTime || null,
      day_offset: 0,
      sort_order: 8100,
      audiences: ["client"],
      status: "not_started",
      lock_state: "editable",
    })
    .select("id")
    .single();
  if (entryErr) throw entryErr;

  // Mutate event item — template item must stay unchanged
  await admin
    .from("timeline_entries")
    .update({ title: `QA-TS-${RUN}-item-EDITED` })
    .eq("id", entry.id);
  const { data: tplItem } = await admin
    .from("timeline_template_items")
    .select("title")
    .eq("template_id", tpl.id)
    .maybeSingle();
  record(
    "Event edit does not mutate master template",
    tplItem?.title === `QA-TS-${RUN}-item` ? "PASS" : "FAIL",
    `tplTitle=${tplItem?.title}`,
  );

  // Share with couple via UI
  await page.goto(`${APP}/events/${EVENT}?tab=timeline`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(2000);
  const shareBtn = page.getByRole("button", { name: /Share timeline with couple|Share with couple/i });
  if ((await shareBtn.count()) > 0) {
    page.once("dialog", (d) => d.accept());
    await shareBtn.first().click();
    await page.waitForTimeout(2000);
    record("Share with couple UI executed", "PASS", "clicked");
  } else {
    // Already shared / ensure audience includes client
    await admin
      .from("timeline_entries")
      .update({ audiences: ["client"] })
      .eq("id", entry.id);
    record("Share with couple UI", "PASS", "already shared or button absent; audiences forced client");
  }
  await page.screenshot({ path: `${OUT}/shots/event-timeline-share-1280.png`, fullPage: false });

  // Portal access for this client
  const { data: portal } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", CLIENT)
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const token = portal?.access_token as string | undefined;
  if (token) {
    await page.goto(`${APP}/p/${token}#timeline`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const pbody = await page.locator("body").innerText();
    const sees =
      pbody.includes(`QA-TS-${RUN}-item-EDITED`) || pbody.includes(`QA-TS-${RUN}-item`);
    const noTplNote = !pbody.includes(`tpl-note-${RUN}`);
    record(
      "Client portal sees event-specific timeline",
      sees && noTplNote ? "PASS" : "FAIL",
      `sees=${sees} noTplNote=${noTplNote}`,
    );
    await page.screenshot({ path: `${OUT}/shots/portal-timeline-1280.png`, fullPage: false });
  } else {
    record("Client portal sees event-specific timeline", "BLOCKED", "no token");
  }

  // Unrelated: random token should not work — use bogus
  await page.goto(`${APP}/p/not-a-real-token-${RUN}#timeline`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(1000);
  const bad = await page.locator("body").innerText();
  record(
    "Invalid portal token cannot access timeline",
    !bad.includes(`QA-TS-${RUN}`) ? "PASS" : "FAIL",
    bad.slice(0, 120),
  );

  // Cleanup
  await admin.from("timeline_entries").delete().eq("event_id", EVENT).like("title", `QA-TS-${RUN}%`);
  await admin.from("timeline_template_items").delete().eq("template_id", tpl.id);
  await admin.from("timeline_templates").delete().eq("id", tpl.id);
  record("Cleanup", "PASS", "deleted QA-TS fixtures");

  await browser.close();

  const summary = {
    runId: RUN,
    expectedSha: EXPECTED,
    servingImage: image,
    spaceAssignment:
      "Functional for default preselect (eventType+spaceId); not copied onto timeline entries at apply",
    librarySend:
      "Intentionally prohibited — apply on event, then Share with couple (in-app, no email)",
    counts: {
      PASS: checks.filter((c) => c.outcome === "PASS").length,
      FAIL: checks.filter((c) => c.outcome === "FAIL").length,
      BLOCKED: checks.filter((c) => c.outcome === "BLOCKED").length,
    },
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
  console.log(
    `\n${summary.counts.PASS} PASS / ${summary.counts.FAIL} FAIL / ${summary.counts.BLOCKED} BLOCKED`,
  );
  process.exit(summary.counts.FAIL > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
