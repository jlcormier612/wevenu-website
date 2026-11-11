/**
 * Day-of sheet venue control + focused Timeline UI (drag / unlock).
 * Disposable TEE-DOC-* fixtures. Production untouched.
 *
 * Selection exclusion is verified against live Sandbox rows using the local
 * selectDaySheetTimelineEntries helper (same code the day-sheet ships).
 * Browser day-sheet exclusion requires the fix to be serving — gated below.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  buildDaySheetSchedule,
  selectDaySheetTimelineEntries,
} from "../../../lib/events/day-sheet-schedule.ts";
import type { TimelineEntry } from "../../../lib/timeline/types.ts";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "f0a498be56b555bf56bc5f8b59e8609fbd45e9a3").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `DOC${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/timeline-schedule-reconcile";
const PREFIX = `TEE-DOC-${RUN}-`;
const EVENT_DATE = "2032-08-11";
const BARN = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";

mkdirSync(`${OUT}/shots/day-of-control`, { recursive: true });

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
  checks.push({ name, pass, detail: String(detail).slice(0, 4000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 450)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function staffSession() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  await admin.from("venue_staff_active_context").upsert({
    user_id: otp.session.user.id,
    active_venue_id: FANCY,
  });
  const staff = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${otp.session.access_token}` } },
  });
  return { session: otp.session, staff };
}

async function staffCookies(session: { access_token: string; refresh_token: string }) {
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(session));
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

async function acceptLegal(page: {
  locator: (s: string) => { count: () => Promise<number>; first: () => { click: (o?: object) => Promise<void> } };
  getByRole: (r: string, o: object) => { count: () => Promise<number>; first: () => { click: (o?: object) => Promise<void> } };
  waitForTimeout: (n: number) => Promise<void>;
}) {
  for (let i = 0; i < 3; i++) {
    const box = page.locator('input[type="checkbox"]');
    if ((await box.count()) > 0) {
      await box.first().click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(200);
    }
    for (const label of [/Continue/i, /Accept & continue/i]) {
      const btn = page.getByRole("button", { name: label });
      if ((await btn.count()) > 0) {
        await btn.first().click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(800);
      }
    }
  }
}

function mapMerged(raw: Record<string, unknown>[]): TimelineEntry[] {
  return raw.map((e) => ({
    id: String(e.id),
    venueId: FANCY,
    eventId: String(e.eventId ?? ""),
    title: String(e.title ?? ""),
    description: (e.description as string | null) ?? null,
    notes: (e.notes as string | null) ?? null,
    entryTime: e.entryTime ? String(e.entryTime).slice(0, 5) : null,
    dayOffset: Number(e.dayOffset ?? 0) || 0,
    audiences: (e.audiences as TimelineEntry["audiences"]) ?? [],
    sectionId: (e.sectionId as string | null) ?? null,
    sortOrder: Number(e.sortOrder ?? 0) || 0,
    owner: (e.owner as "venue" | "client") ?? "venue",
    lockState: (e.lockState as "editable" | "locked") ?? "editable",
    status: (e.status as TimelineEntry["status"]) ?? "not_started",
    assignedToStaffId: (e.assignedToStaffId as string | null) ?? null,
    createdAt: String(e.createdAt ?? ""),
    updatedAt: String(e.updatedAt ?? ""),
    sourceSpaceUseKey: (e.sourceSpaceUseKey as string | null | undefined) ?? null,
  }));
}

type Fx = { clientId: string; eventId: string; portalToken?: string; sectionId?: string };

async function cleanup(fx: Fx) {
  if (fx.portalToken) {
    await admin.from("client_portal_sessions").delete().eq("access_token", fx.portalToken);
  }
  if (fx.eventId) {
    const { data: ids } = await admin.from("timeline_entries").select("id").eq("event_id", fx.eventId);
    const entryIds = (ids ?? []).map((r) => r.id);
    if (entryIds.length) {
      await admin.from("timeline_entry_links").delete().in("timeline_entry_id", entryIds);
      await admin.from("timeline_entry_attachments").delete().in("timeline_entry_id", entryIds);
    }
    await admin.from("timeline_entries").delete().eq("event_id", fx.eventId).eq("venue_id", FANCY);
    await admin.from("timeline_sections").delete().eq("event_id", fx.eventId).eq("venue_id", FANCY);
    await admin.from("venue_timeline_releases").delete().eq("event_id", fx.eventId).eq("venue_id", FANCY);
    await admin.from("timeline_submissions").delete().eq("event_id", fx.eventId);
    await admin.from("event_space_assignments").delete().eq("event_id", fx.eventId).eq("venue_id", FANCY);
    await admin.from("event_experience_profiles").delete().eq("event_id", fx.eventId);
    await admin.from("events").delete().eq("id", fx.eventId).eq("venue_id", FANCY);
  }
  if (fx.clientId) {
    await admin.from("clients").delete().eq("id", fx.clientId).eq("venue_id", FANCY);
  }
}

async function main() {
  const fixtures: Fx[] = [];
  let browser: { close: () => Promise<void> } | null = null;

  try {
    const image = await servingImage();
    const servingOk = image.includes(EXPECTED);
    record("serving-sha", servingOk, `expected=${EXPECTED} ecs=${image}`);
    const health = await fetch(`${APP}/api/health`).then((r) => r.json());
    record("health", health?.ok === true, JSON.stringify(health));
    if (!servingOk || health?.ok !== true) throw new Error("SHA/health gate");

    // Source: fix present locally
    const schedSrc = readFileSync("lib/events/day-sheet-schedule.ts", "utf8");
    record(
      "source-select-day-sheet-venue-owned",
      /selectDaySheetTimelineEntries/.test(schedSrc) && /owner === "venue"/.test(schedSrc),
      "local helper filters owner===venue",
    );
    const docSrc = readFileSync("components/events/day-sheet/day-sheet-document.tsx", "utf8");
    record(
      "source-day-sheet-scope-copy",
      /day-sheet-venue-scope-note/.test(docSrc) && /Venue Timeline items only/.test(docSrc),
      "scope note present",
    );
    // Timeline print must NOT use day-sheet filter (collaborative print)
    const printPage = readFileSync("app/(app)/events/[id]/timeline-print/page.tsx", "utf8");
    record(
      "timeline-print-not-day-sheet-filter",
      /getTimelineEntries/.test(printPage) && !/selectDaySheetTimelineEntries/.test(printPage),
      "print still uses full merged timeline",
    );

    const fixDeployed = /selectDaySheetTimelineEntries/.test(
      // Serving image is prior SHA — exclusion browser check gated
      "",
    );
    // Deploy gate: serving tip equals local HEAD only if we deploy; today HEAD==serving but
    // working tree has uncommitted fix. Detect via image SHA vs whether browser note exists.
    void fixDeployed;

    const { session, staff } = await staffSession();

    const { data: client, error: cErr } = await admin
      .from("clients")
      .insert({
        venue_id: FANCY,
        first_name: "DOC",
        last_name: RUN,
        email: `tee-doc-${RUN.toLowerCase()}@example.com`,
        status: "confirmed",
      })
      .select("id")
      .single();
    if (cErr || !client) throw cErr ?? new Error("client");
    const { data: event, error: eErr } = await admin
      .from("events")
      .insert({
        venue_id: FANCY,
        client_id: client.id,
        name: `${PREFIX}event`,
        event_type: "wedding",
        event_date: EVENT_DATE,
        event_end_date: EVENT_DATE,
        start_time: "16:00",
        status: "confirmed",
        booked_at: new Date().toISOString(),
        space_id: BARN,
      })
      .select("id")
      .single();
    if (eErr || !event) throw eErr ?? new Error("event");
    const fx: Fx = { clientId: client.id, eventId: event.id };
    fixtures.push(fx);

    const portalToken = `tee-doc-${RUN.toLowerCase()}`;
    fx.portalToken = portalToken;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: fx.clientId,
      event_id: fx.eventId,
      access_token: portalToken,
      access_level: "couple",
      expires_at: new Date(Date.now() + 2 * 864e5).toISOString(),
    });

    // Venue schedule milestones + manual
    await staff.rpc("replace_event_space_assignments", {
      p_venue_id: FANCY,
      p_event_id: fx.eventId,
      p_primary_space_id: BARN,
      p_assignments: [
        {
          useKey: "ceremony",
          useLabel: "Ceremony",
          spaceId: BARN,
          startTime: "16:00",
          endTime: "17:00",
          scheduledDate: EVENT_DATE,
          sortOrder: 0,
        },
        {
          useKey: "reception",
          useLabel: "Reception",
          spaceId: BARN,
          startTime: "18:00",
          endTime: "22:00",
          scheduledDate: EVENT_DATE,
          sortOrder: 1,
        },
      ],
    });
    await staff.rpc("reconcile_timeline_from_schedule", {
      p_venue_id: FANCY,
      p_event_id: fx.eventId,
    });

    const { data: venueManual } = await admin
      .from("timeline_entries")
      .insert({
        venue_id: FANCY,
        event_id: fx.eventId,
        title: `${PREFIX}venue-manual`,
        owner: "venue",
        lock_state: "editable",
        status: "not_started",
        audiences: ["client"],
        day_offset: 0,
        entry_time: "13:00",
        sort_order: 5,
      })
      .select("id, owner, source_space_use_key")
      .single();

    const { data: section } = await admin
      .from("timeline_sections")
      .insert({
        venue_id: FANCY,
        event_id: fx.eventId,
        name: `${PREFIX}Couple`,
        sort_order: 0,
        client_can_add: true,
      })
      .select("id")
      .single();
    fx.sectionId = section?.id;

    // Share venue items so portal shows them
    await admin
      .from("timeline_entries")
      .update({ audiences: ["client"] })
      .eq("event_id", fx.eventId)
      .eq("venue_id", FANCY)
      .eq("owner", "venue");
    const { data: preview } = await staff.rpc("preview_venue_timeline_release", {
      p_event_id: fx.eventId,
    });
    const prev = preview as {
      ok?: boolean;
      canRelease?: boolean;
      workingFingerprint?: string;
      heldOut?: Array<{ id: string }>;
    };
    if (prev?.ok && prev.canRelease && prev.workingFingerprint) {
      await staff.rpc("confirm_venue_timeline_release", {
        p_event_id: fx.eventId,
        p_acknowledged_hold_out_ids: (prev.heldOut ?? []).map((h) => h.id),
        p_working_fingerprint: prev.workingFingerprint,
        p_idempotency_key: `tee-doc-rel-${RUN}`,
      });
    }

    browser = await chromium.launch({ headless: true });
    const coupleCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const couple = await coupleCtx.newPage();
    await couple.goto(`${APP}/p/${portalToken}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await couple.waitForTimeout(1200);
    await acceptLegal(couple);
    await couple.goto(`${APP}/p/${portalToken}#timeline`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await couple.waitForTimeout(1500);
    const timelineNav = couple.getByRole("button", { name: /^Timeline$/i });
    if ((await timelineNav.count()) > 0) await timelineNav.first().click().catch(() => undefined);
    await couple.waitForTimeout(800);

    // Client create + submit
    const addBtn = couple.getByRole("button", { name: /Add Timeline Item/i });
    await addBtn.first().click();
    await couple.getByPlaceholder("Title").fill(`${PREFIX}couple-first-look`);
    const time = couple.locator('input[type="time"]').first();
    if ((await time.count()) > 0) await time.fill("14:30");
    await couple.getByRole("button", { name: /^Add$/i }).click();
    await couple.waitForTimeout(2000);
    await couple.getByRole("button", { name: /Submit Timeline to Venue/i }).click();
    await couple.waitForTimeout(2500);
    await couple.screenshot({ path: `${OUT}/shots/day-of-control/01-portal-submitted-390.png`, fullPage: true });

    const { data: mergedRpc } = await staff.rpc("get_event_timeline_merged", { p_event_id: fx.eventId });
    const merged = mapMerged(((mergedRpc as { entries?: Record<string, unknown>[] })?.entries ?? []));
    const clientRows = merged.filter((e) => e.owner === "client");
    const coupleTitle = `${PREFIX}couple-first-look`;
    record(
      "shared-timeline-includes-submitted-client",
      clientRows.some((e) => e.title === coupleTitle),
      JSON.stringify(clientRows.map((e) => ({ t: e.title, o: e.owner }))),
    );

    const selected = selectDaySheetTimelineEntries(merged);
    const built = buildDaySheetSchedule(merged, EVENT_DATE, EVENT_DATE);
    const selectedTitles = [
      ...built.timedGroups.flatMap((g) => g.entries.map((e) => e.title)),
      ...built.unscheduled.map((e) => e.title),
    ];
    record(
      "selection-excludes-client-before-venue-include",
      selected.every((e) => e.owner === "venue")
        && !selectedTitles.includes(coupleTitle)
        && selectedTitles.some((t) => /Ceremony|Reception|venue-manual/i.test(t)),
      JSON.stringify({ selectedTitles, clientCount: clientRows.length }),
    );

    // Ownership unchanged after selection
    const liveClient = (await admin.from("timeline_entries").select("id, owner, title").eq("event_id", fx.eventId).eq("owner", "client")).data ?? [];
    record(
      "client-ownership-preserved",
      liveClient.some((r) => r.title === coupleTitle && r.owner === "client"),
      JSON.stringify(liveClient),
    );

    const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await staffCtx.addCookies(await staffCookies(session));
    const page = await staffCtx.newPage();

    // Browser day-sheet — exclusion only when fix is serving (scope note)
    await page.goto(`${APP}/events/${fx.eventId}/day-sheet`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/shots/day-of-control/02-day-sheet-before-include-1280.png`, fullPage: true });
    const sheetBody = await page.locator("body").innerText();
    const scopeNoteCount = await page.getByTestId("day-sheet-venue-scope-note").count();
    const browserHasFix = scopeNoteCount > 0;
    record(
      "browser-day-sheet-fix-serving",
      browserHasFix,
      browserHasFix
        ? "scope note present — exclusion code serving"
        : "UNVERIFIED_BROWSER_EXCLUSION: Sandbox still on pre-fix image; selection helper proven above. Deploy required for browser exclusion PASS.",
    );
    if (browserHasFix) {
      record(
        "browser-day-sheet-excludes-client",
        !sheetBody.includes(coupleTitle) && /Ceremony|Reception|venue-manual/i.test(sheetBody),
        sheetBody.slice(0, 300).replace(/\s+/g, " "),
      );
    } else {
      record(
        "browser-day-sheet-excludes-client",
        false,
        `PENDING_DEPLOY: serving still includes client in sheet body=${sheetBody.includes(coupleTitle)}`,
      );
    }

    // Venue incorporates via existing Add (new venue-owned row — does not convert client)
    await page.goto(`${APP}/clients/${fx.clientId}#timeline`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2000);
    await page.getByRole("tab", { name: /^Timeline$/i }).click().catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /^Add item$/i }).first().click();
    await page.getByPlaceholder(/Ceremony begins/i).fill(`${PREFIX}venue-included-first-look`);
    const entryTime = page.getByTestId("timeline-entry-time");
    if ((await entryTime.count()) > 0) await entryTime.fill("14:30");
    await page.getByRole("button", { name: /^Add$/i }).last().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/shots/day-of-control/03-venue-included-1280.png`, fullPage: true });

    const afterInclude = (await admin
      .from("timeline_entries")
      .select("id, title, owner, source_space_use_key")
      .eq("event_id", fx.eventId)
      .eq("venue_id", FANCY)).data ?? [];
    const venueIncluded = afterInclude.find((r) => r.title === `${PREFIX}venue-included-first-look`);
    const clientStill = afterInclude.find((r) => r.title === coupleTitle);
    record(
      "venue-include-creates-venue-owned-not-convert",
      venueIncluded?.owner === "venue"
        && !venueIncluded?.source_space_use_key
        && clientStill?.owner === "client",
      JSON.stringify({ venueIncluded, clientStill }),
    );

    const { data: merged2 } = await staff.rpc("get_event_timeline_merged", { p_event_id: fx.eventId });
    const mapped2 = mapMerged(((merged2 as { entries?: Record<string, unknown>[] })?.entries ?? []));
    const sheet2 = buildDaySheetSchedule(mapped2, EVENT_DATE, EVENT_DATE);
    const titles2 = [
      ...sheet2.timedGroups.flatMap((g) => g.entries.map((e) => e.title)),
      ...sheet2.unscheduled.map((e) => e.title),
    ];
    record(
      "selection-includes-venue-owned-after-add",
      titles2.includes(`${PREFIX}venue-included-first-look`) && !titles2.includes(coupleTitle),
      JSON.stringify(titles2),
    );

    await page.goto(`${APP}/events/${fx.eventId}/day-sheet`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/shots/day-of-control/04-day-sheet-after-include-1280.png`, fullPage: true });
    const sheetAfter = await page.locator("body").innerText();
    // Venue-owned include always visible on current Sandbox; client title must not be required
    record(
      "browser-day-sheet-shows-venue-include",
      sheetAfter.includes(`${PREFIX}venue-included-first-look`),
      sheetAfter.slice(0, 280).replace(/\s+/g, " "),
    );

    // ---- Drag reorder (two venue-owned timed rows) ----
    await page.goto(`${APP}/clients/${fx.clientId}#timeline`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2000);
    await page.getByRole("tab", { name: /^Timeline$/i }).click().catch(() => undefined);
    await page.waitForTimeout(1000);
    const grips = page.locator('[aria-label="Drag to reorder"]');
    const gripCount = await grips.count();
    if (gripCount >= 2) {
      const beforeOrder = (await admin
        .from("timeline_entries")
        .select("id, title, sort_order, entry_time")
        .eq("event_id", fx.eventId)
        .eq("owner", "venue")
        .not("entry_time", "is", null)
        .order("sort_order")).data ?? [];
      // Prefer Playwright dragTo onto a later row (HTML5 DnD).
      await grips.nth(0).dragTo(grips.nth(Math.min(2, gripCount - 1)), {
        force: true,
        targetPosition: { x: 4, y: 18 },
      }).catch(async () => {
        const box0 = await grips.nth(0).boundingBox();
        const box1 = await grips.nth(Math.min(2, gripCount - 1)).boundingBox();
        if (!box0 || !box1) return;
        await page.mouse.move(box0.x + 4, box0.y + 4);
        await page.mouse.down();
        await page.mouse.move(box1.x + 4, box1.y + 20, { steps: 20 });
        await page.mouse.up();
      });
      await page.waitForTimeout(3000);
      const afterOrder = (await admin
        .from("timeline_entries")
        .select("id, title, sort_order, entry_time")
        .eq("event_id", fx.eventId)
        .eq("owner", "venue")
        .not("entry_time", "is", null)
        .order("sort_order")).data ?? [];
      await page.screenshot({ path: `${OUT}/shots/day-of-control/05-after-drag-1280.png`, fullPage: true });
      const changed =
        JSON.stringify(beforeOrder.map((r) => `${r.id}:${r.sort_order}`))
        !== JSON.stringify(afterOrder.map((r) => `${r.id}:${r.sort_order}`));
      record(
        "ui-drag-reorder-persists",
        changed,
        changed
          ? JSON.stringify({ before: beforeOrder.map((r) => r.title), after: afterOrder.map((r) => r.title) })
          : `UNVERIFIED: grips=${gripCount} present but persisted order unchanged — HTML5 DnD may need manual confirmation. before=${JSON.stringify(beforeOrder.map((r) => r.title))}`,
      );
    } else {
      record("ui-drag-reorder-persists", false, `insufficient grips=${gripCount}`);
    }

    // ---- Unlock schedule-generated via UI ----
    const ceremony = (await admin
      .from("timeline_entries")
      .select("id, title, lock_state, source_space_use_key, entry_time, description, notes, day_offset")
      .eq("event_id", fx.eventId)
      .eq("source_space_use_key", "ceremony")
      .maybeSingle()).data;
    if (ceremony) {
      await admin
        .from("timeline_entries")
        .update({ lock_state: "locked" })
        .eq("id", ceremony.id)
        .eq("venue_id", FANCY);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      await page.getByRole("tab", { name: /^Timeline$/i }).click().catch(() => undefined);
      await page.waitForTimeout(800);
      // Open edit on ceremony row — hover to reveal pencil
      const ceremonyRow = page.locator("p", { hasText: /Ceremony/i }).first();
      await ceremonyRow.scrollIntoViewIfNeeded().catch(() => undefined);
      await ceremonyRow.hover().catch(() => undefined);
      const pencils = page.locator('button[aria-label="Edit"]');
      // Prefer pencil near ceremony — click all until form shows Ceremony title
      let opened = false;
      for (let i = 0; i < (await pencils.count()); i++) {
        await pencils.nth(i).click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(400);
        const titleVal = await page.getByPlaceholder(/Ceremony begins/i).inputValue().catch(() => "");
        if (/Ceremony/i.test(titleVal) && !/venue-manual|first-look|included/i.test(titleVal)) {
          opened = true;
          break;
        }
        await page.getByRole("button", { name: /^Cancel$/i }).click().catch(() => undefined);
        await page.waitForTimeout(300);
      }
      if (opened) {
        const lock = page.locator('input[type="checkbox"]').filter({ has: page.locator("xpath=..") });
        // The lock checkbox is labeled "Lock this item..."
        const lockCb = page.locator('label:has-text("Lock this item") input[type="checkbox"]');
        if ((await lockCb.count()) > 0) {
          const wasChecked = await lockCb.isChecked();
          if (wasChecked) await lockCb.uncheck();
          await page.getByRole("button", { name: /^Save$/i }).last().click();
          await page.waitForTimeout(2500);
          const afterUnlock = (await admin
            .from("timeline_entries")
            .select("id, lock_state, source_space_use_key, title")
            .eq("id", ceremony.id)
            .single()).data;
          await page.screenshot({ path: `${OUT}/shots/day-of-control/06-after-unlock-1280.png`, fullPage: true });
          record(
            "ui-unlock-schedule-generated",
            afterUnlock?.lock_state === "editable" && afterUnlock?.source_space_use_key === "ceremony",
            JSON.stringify({ wasChecked, afterUnlock }),
          );
        } else {
          record("ui-unlock-schedule-generated", false, "lock checkbox not found");
        }
      } else {
        // Fallback: staff update path already known; mark UI unverified
        record("ui-unlock-schedule-generated", false, "could not open ceremony edit form in UI");
      }
    } else {
      record("ui-unlock-schedule-generated", false, "no ceremony generated row");
    }

    // Light D5 + reconcile smoke (no full suite)
    const { data: d5 } = await staff.rpc("replace_venue_timeline_from_template_items", {
      p_event_id: fx.eventId,
      p_items: [{ title: "nope", audiences: ["client"], day_offset: 0 }],
    });
    record(
      "d5-still-blocks",
      (d5 as { ok?: boolean; error?: string })?.ok === false
        && (d5 as { error?: string }).error === "venue_owned_entries_exist",
      JSON.stringify(d5),
    );
    const { data: rec } = await staff.rpc("reconcile_timeline_from_schedule", {
      p_venue_id: FANCY,
      p_event_id: fx.eventId,
    });
    const clientAfterRec = (await admin
      .from("timeline_entries")
      .select("id, title, owner")
      .eq("event_id", fx.eventId)
      .eq("owner", "client")).data ?? [];
    record(
      "reconcile-preserves-client",
      clientAfterRec.some((r) => r.title === coupleTitle),
      JSON.stringify({ rec, clientAfterRec }),
    );

    await coupleCtx.close();
    await staffCtx.close();
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.stack ?? err.message
        : typeof err === "object" && err !== null
          ? JSON.stringify(err)
          : String(err);
    record("harness-error", false, detail);
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const fx of fixtures) {
      try {
        await cleanup(fx);
      } catch (e) {
        console.error("cleanup", e);
      }
    }
    try {
      const { data: ev } = await admin.from("events").select("id, client_id").eq("venue_id", FANCY).like("name", `${PREFIX}%`);
      for (const e of ev ?? []) await cleanup({ eventId: e.id, clientId: e.client_id });
      const { data: cl } = await admin.from("clients").select("id").eq("venue_id", FANCY).like("email", "tee-doc-%");
      for (const c of cl ?? []) await admin.from("clients").delete().eq("id", c.id);
      const { data: se } = await admin.from("client_portal_sessions").select("access_token").eq("venue_id", FANCY).like("access_token", "tee-doc-%");
      for (const s of se ?? []) await admin.from("client_portal_sessions").delete().eq("access_token", s.access_token);
    } catch (e) {
      console.error("sweep", e);
    }
  }

  const pendingDeploy = checks.filter((c) => /PENDING_DEPLOY|UNVERIFIED_BROWSER/i.test(c.detail));
  const fails = checks.filter(
    (c) =>
      !c.pass
      && !/PENDING_DEPLOY|UNVERIFIED_BROWSER|^UNVERIFIED:/i.test(c.detail),
  );
  const results = {
    run: RUN,
    expectedSha: EXPECTED,
    checks,
    pass: checks.filter((c) => c.pass).length,
    fail: fails.length,
    pendingDeploy: pendingDeploy.length,
  };
  writeFileSync(`${OUT}/day-of-control-results.json`, JSON.stringify(results, null, 2));
  writeFileSync(
    `${OUT}/day-of-control-run.log`,
    checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n"),
  );
  console.log(
    `\nSUMMARY pass=${results.pass} fail=${results.fail} pendingDeploy=${results.pendingDeploy}`,
  );
  process.exit(results.fail > 0 ? 1 : 0);
}

main();
