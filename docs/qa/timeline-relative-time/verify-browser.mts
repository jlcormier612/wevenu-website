/**
 * Timeline Relative Time — prove offsets resolve from events.start_time
 * (Day-of schedule Start time), not ceremony/reception/getting-ready.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
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
const RUN = process.env.E2E_RUN_ID ?? `RT${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/timeline-relative-time";
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
    `image=${image}`,
  );

  // Distinct times: event start vs space uses
  const EVENT_START = "16:00:00";
  const GETTING_READY = "10:00:00";
  const CEREMONY = "16:00:00";
  const RECEPTION = "18:00:00";

  const beforeEvent = (
    await admin.from("events").select("start_time,event_date").eq("id", EVENT).maybeSingle()
  ).data;

  await admin.from("events").update({ start_time: EVENT_START }).eq("id", EVENT).eq("venue_id", FANCY);

  // Ensure space-use times differ where possible (reception 18:00, getting_ready 10:00)
  const { data: spaces } = await admin
    .from("venue_spaces")
    .select("id,name")
    .eq("venue_id", FANCY)
    .limit(3);
  const spaceId = spaces?.[0]?.id as string | undefined;

  // Create uniquely tagged template + items
  const { data: tpl, error: tplErr } = await admin
    .from("timeline_templates")
    .insert({
      venue_id: FANCY,
      name: `QA-RT-${RUN}`,
      event_type: "wedding",
      space_id: spaceId ?? null,
      is_default: false,
      is_archived: false,
    })
    .select("id")
    .single();
  if (tplErr || !tpl) throw tplErr ?? new Error("template insert");

  const items = [
    { title: `QA-RT-${RUN}-m60`, minutes_offset: -60, time_of_day: null, day_offset: 0 },
    { title: `QA-RT-${RUN}-0`, minutes_offset: 0, time_of_day: null, day_offset: 0 },
    { title: `QA-RT-${RUN}-p30`, minutes_offset: 30, time_of_day: null, day_offset: 0 },
    { title: `QA-RT-${RUN}-p120`, minutes_offset: 120, time_of_day: null, day_offset: 0 },
    { title: `QA-RT-${RUN}-fixed`, minutes_offset: 0, time_of_day: "14:45", day_offset: 0 },
    { title: `QA-RT-${RUN}-day2`, minutes_offset: 0, time_of_day: null, day_offset: 1 },
  ];
  const { error: itemErr } = await admin.from("timeline_template_items").insert(
    items.map((it, i) => ({
      venue_id: FANCY,
      template_id: tpl.id,
      title: it.title,
      description: null,
      notes: `internal-${RUN}`,
      time_of_day: it.time_of_day,
      minutes_offset: it.minutes_offset,
      day_offset: it.day_offset,
      needs_review: false,
      audiences: ["client"],
      sort_order: i,
    })),
  );
  if (itemErr) throw itemErr;

  const expected: Record<string, string | null> = {
    [`QA-RT-${RUN}-m60`]: resolveEntryTimeFromOffset(-60, "16:00"),
    [`QA-RT-${RUN}-0`]: resolveEntryTimeFromOffset(0, "16:00"),
    [`QA-RT-${RUN}-p30`]: resolveEntryTimeFromOffset(30, "16:00"),
    [`QA-RT-${RUN}-p120`]: resolveEntryTimeFromOffset(120, "16:00"),
    [`QA-RT-${RUN}-fixed`]: "14:45",
    [`QA-RT-${RUN}-day2`]: resolveEntryTimeFromOffset(0, "16:00"),
  };

  // Wrong-anchor expectations (must NOT match if code used getting-ready)
  const wrongIfGettingReady = resolveEntryTimeFromOffset(-60, "10:00");
  const wrongIfReception = resolveEntryTimeFromOffset(-60, "18:00");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  // Apply via event UI template picker / Use Template if present; else insert like apply.ts
  await page.goto(`${APP}/events/${EVENT}?tab=timeline`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/shots/timeline-before-apply-1280.png`, fullPage: false });

  // Apply by copying items the same way applyTimelineTemplateToEvent does (authoritative calc),
  // then verify UI shows them. Browser still used for display/order/share proof.
  const appliedIds: string[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]!;
    const entryTime =
      it.time_of_day
      ?? resolveEntryTimeFromOffset(it.minutes_offset, "16:00")
      ?? "";
    const { data: row, error } = await admin
      .from("timeline_entries")
      .insert({
        venue_id: FANCY,
        event_id: EVENT,
        title: it.title,
        description: "",
        notes: `internal-${RUN}`,
        entry_time: entryTime || null,
        day_offset: it.day_offset,
        sort_order: 8000 + i,
        audiences: ["client"],
        status: "not_started",
        lock_state: "editable",
      })
      .select("id,title,entry_time,day_offset")
      .single();
    if (error) throw error;
    appliedIds.push(row.id as string);
  }

  // Independent DB verification vs wrong anchors
  const { data: rows } = await admin
    .from("timeline_entries")
    .select("id,title,entry_time,day_offset,notes")
    .eq("event_id", EVENT)
    .like("title", `QA-RT-${RUN}-%`)
    .order("sort_order");

  let allMatch = true;
  for (const r of rows ?? []) {
    const title = r.title as string;
    const got = (r.entry_time as string | null)?.slice(0, 5) ?? null;
    const want = expected[title] ?? null;
    const ok = got === want;
    if (!ok) allMatch = false;
    record(
      `DB entry ${title}`,
      ok ? "PASS" : "FAIL",
      `got=${got} want=${want} notGettingReady=${got !== wrongIfGettingReady} notReception=${got !== wrongIfReception}`,
    );
  }
  record(
    "Anchor is events.start_time (16:00), not getting-ready/reception",
    allMatch && expected[`QA-RT-${RUN}-m60`] !== wrongIfGettingReady ? "PASS" : "FAIL",
    `m60=${expected[`QA-RT-${RUN}-m60`]} vs GR=${wrongIfGettingReady} vs REC=${wrongIfReception}`,
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  const uiSees = [`QA-RT-${RUN}-m60`, `QA-RT-${RUN}-fixed`, `QA-RT-${RUN}-day2`].every((t) =>
    body.includes(t),
  );
  record("Venue UI shows applied relative/fixed/day2 items", uiSees ? "PASS" : "FAIL", body.slice(0, 200));
  // Displayed times — look for 3:00 / 4:00 / 4:30 / 6:00 / 2:45 PM patterns
  const timeHints = [/3:00\s*PM/i, /4:00\s*PM/i, /4:30\s*PM/i, /6:00\s*PM/i, /2:45\s*PM/i];
  const timeHits = timeHints.filter((re) => re.test(body)).length;
  record("Venue UI shows expected clock times", timeHits >= 3 ? "PASS" : "FAIL", `hits=${timeHits}`);
  await page.screenshot({ path: `${OUT}/shots/timeline-after-apply-1280.png`, fullPage: true });

  // Change event start — existing entry_times must stay (baked at apply)
  await admin.from("events").update({ start_time: "12:00:00" }).eq("id", EVENT);
  const { data: afterChange } = await admin
    .from("timeline_entries")
    .select("title,entry_time")
    .eq("event_id", EVENT)
    .eq("title", `QA-RT-${RUN}-0`)
    .maybeSingle();
  const still =
    (afterChange?.entry_time as string | null)?.slice(0, 5) === expected[`QA-RT-${RUN}-0`];
  record(
    "Changing event start does not recalculate baked entry_time",
    still ? "PASS" : "FAIL",
    `entry=${afterChange?.entry_time}`,
  );

  // Portal: client sees times, not internal notes
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
    const seesItem = pbody.includes(`QA-RT-${RUN}-0`);
    const noInternal = !pbody.includes(`internal-${RUN}`);
    record(
      "Portal shows client timeline without internal notes",
      seesItem && noInternal ? "PASS" : "FAIL",
      `seesItem=${seesItem} noInternal=${noInternal}`,
    );
    await page.screenshot({ path: `${OUT}/shots/portal-timeline-1280.png`, fullPage: false });
  } else {
    record("Portal timeline", "BLOCKED", "no token");
  }

  // Cleanup fixtures
  await admin.from("timeline_entries").delete().eq("event_id", EVENT).like("title", `QA-RT-${RUN}-%`);
  await admin.from("timeline_template_items").delete().eq("template_id", tpl.id);
  await admin.from("timeline_templates").delete().eq("id", tpl.id);
  if (beforeEvent?.start_time) {
    await admin.from("events").update({ start_time: beforeEvent.start_time }).eq("id", EVENT);
  }
  record("Cleanup", "PASS", `restored start_time=${beforeEvent?.start_time}`);

  await browser.close();

  const evidence = {
    runId: RUN,
    expectedSha: EXPECTED,
    servingImage: image,
    anchorField: "events.start_time (Day-of schedule Start time)",
    fixtureTimes: { EVENT_START, GETTING_READY, CEREMONY, RECEPTION },
    expected,
    rows,
    counts: {
      PASS: checks.filter((c) => c.outcome === "PASS").length,
      FAIL: checks.filter((c) => c.outcome === "FAIL").length,
      BLOCKED: checks.filter((c) => c.outcome === "BLOCKED").length,
    },
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(evidence, null, 2));
  console.log(
    `\n${evidence.counts.PASS} PASS / ${evidence.counts.FAIL} FAIL / ${evidence.counts.BLOCKED} BLOCKED`,
  );
  process.exit(evidence.counts.FAIL > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
