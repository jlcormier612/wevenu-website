/**
 * PM-04 — populate Practice Run sample Event planning resources.
 * Uses venue templates when present; otherwise clearly labeled practice-only rows.
 * Never writes into permanent template libraries or Setup Profiles.
 */

import { TIMELINE_TEMPLATES } from "@/lib/timeline/constants";
import {
  emptyPracticePlanning,
  type PracticePlanningSnapshot,
  type PracticePlanningSource,
} from "@/lib/practice-run/journey";
import type { PracticeRun } from "@/lib/practice-run/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

const PRACTICE_DOC_URL = "https://example.invalid/practice/placeholder.txt";

function dueFromOffset(eventDate: string, daysOffset: number): string {
  const [y, m, d] = eventDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + daysOffset));
  return dt.toISOString().slice(0, 10);
}

async function resolveEventDate(client: DbClient, venueId: string, eventId: string): Promise<string> {
  const { data } = await client
    .from("events")
    .select("event_date")
    .eq("id", eventId)
    .eq("venue_id", venueId)
    .maybeSingle();
  return (data as { event_date?: string } | null)?.event_date || "2027-09-12";
}

async function detectTaskSource(
  client: DbClient,
  venueId: string,
): Promise<{ source: PracticePlanningSource; templateId: string | null }> {
  const { data } = await client
    .from("playbook_templates")
    .select("id,name,kind")
    .eq("venue_id", venueId)
    .eq("kind", "client")
    .ilike("name", "%wedding%")
    .limit(1)
    .maybeSingle();
  if (data?.id) return { source: "venue_template", templateId: data.id as string };
  return { source: "practice_fallback", templateId: null };
}

async function detectTimelineSource(
  client: DbClient,
  venueId: string,
): Promise<{ source: PracticePlanningSource; templateId: string | null }> {
  const { data } = await client
    .from("timeline_templates")
    .select("id,name")
    .eq("venue_id", venueId)
    .ilike("name", "%wedding%")
    .limit(1)
    .maybeSingle();
  if (data?.id) return { source: "venue_template", templateId: data.id as string };
  return { source: "htc_starter", templateId: null };
}

/**
 * Idempotent seed: if planning.preparedAt already set and resources exist, return as-is.
 */
export async function seedPracticePlanningResources(
  client: DbClient,
  venueId: string,
  run: PracticeRun,
): Promise<PracticePlanningSnapshot> {
  if (!run.sampleEventId || !run.sampleClientId) {
    return emptyPracticePlanning();
  }
  if (
    run.journey.planning?.preparedAt
    && run.journey.planning.resourceIds.taskIds.length > 0
    && run.journey.planning.resourceIds.questionnaireId
    && run.journey.planning.counts.timeline >= 8
  ) {
    return run.journey.planning;
  }

  // When refreshing an incomplete prior prepare, continue from the last snapshot.
  const planning = run.journey.planning?.preparedAt
    ? structuredClone(run.journey.planning)
    : emptyPracticePlanning();

  const eventId = run.sampleEventId;
  const clientId = run.sampleClientId;
  const eventDate = await resolveEventDate(client, venueId, eventId);

  const taskSource = await detectTaskSource(client, venueId);
  planning.sources.tasks = taskSource.source;

  // Prefer applying an existing venue playbook when available.
  if (taskSource.templateId) {
    try {
      const { applyPlaybookToEvent } = await import("@/lib/playbooks/repository");
      const { capabilitiesFromVenueRow } = await import("@/lib/playbooks/capabilities");
      const { data: venueRow } = await client
        .from("venues")
        .select(
          "planning_checklists_enabled, planning_timeline_enabled, planning_floor_plan_enabled, planning_seating_enabled, planning_vendors_enabled, planning_inventory_enabled, planning_event_order_enabled, planning_questionnaires_enabled",
        )
        .eq("id", venueId)
        .maybeSingle();
      await applyPlaybookToEvent(
        client,
        venueId,
        eventId,
        taskSource.templateId,
        eventDate,
        capabilitiesFromVenueRow(venueRow),
      );
    } catch {
      // Fall through to practice-only inserts.
      planning.sources.tasks = "practice_fallback";
    }
  }

  const { count: existingTaskCount } = await client
    .from("event_tasks")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .eq("event_id", eventId);

  if (!existingTaskCount) {
    planning.sources.tasks = "practice_fallback";
    const practiceTasks = [
      {
        title: "Practice: Complete your planning questionnaire",
        description: "Practice-only client task. Tell the venue about your celebration vision.",
        owner_type: "couple",
        visibility: "client_owned",
        days_offset: -90,
        category: "planning",
        milestone_name: "Planning",
        is_required: true,
        sort_order: 0,
        status: "pending",
      },
      {
        title: "Practice: Confirm final guest count",
        description: "Practice-only client-visible task released after Share.",
        owner_type: "couple",
        visibility: "coordinator_only",
        days_offset: -30,
        category: "planning",
        milestone_name: "Final Details",
        is_required: true,
        sort_order: 1,
        status: "pending",
        releaseLater: true,
      },
      {
        title: "Practice: Share a song request",
        description: "Practice-only client-owned task you can complete in Client view.",
        owner_type: "couple",
        visibility: "client_owned",
        days_offset: -21,
        category: "planning",
        milestone_name: "Final Details",
        is_required: false,
        sort_order: 2,
        status: "pending",
      },
      {
        title: "Practice: Build the venue timeline",
        description: "Venue-owned practice task. Stays private until you choose to share related resources.",
        owner_type: "coordinator",
        visibility: "coordinator_only",
        days_offset: -21,
        category: "planning",
        milestone_name: "Planning",
        is_required: true,
        sort_order: 3,
        status: "complete",
        completed_at: new Date().toISOString(),
      },
      {
        title: "Practice: Internal floor-plan notes",
        description: "Venue-only practice task — never shown to the couple.",
        owner_type: "coordinator",
        visibility: "coordinator_only",
        days_offset: -14,
        category: "planning",
        milestone_name: "Planning",
        is_required: false,
        sort_order: 4,
        status: "pending",
        keepPrivate: true,
      },
    ] as const;

    for (const t of practiceTasks) {
      const { data, error } = await client
        .from("event_tasks")
        .insert({
          venue_id: venueId,
          event_id: eventId,
          client_id: clientId,
          title: t.title,
          description: t.description,
          owner_type: t.owner_type,
          visibility: t.visibility,
          due_date: dueFromOffset(eventDate, t.days_offset),
          days_offset: t.days_offset,
          category: t.category,
          milestone_name: t.milestone_name,
          is_required: t.is_required,
          sort_order: t.sort_order,
          status: t.status,
          completed_at: "completed_at" in t ? t.completed_at : null,
          due_date_rule_kind: "relative_to_event",
        })
        .select("id")
        .single();
      if (error || !data) continue;
      const id = (data as { id: string }).id;
      planning.resourceIds.taskIds.push(id);
      if ("releaseLater" in t && t.releaseLater) planning.resourceIds.releaseTaskIds.push(id);
      if ("keepPrivate" in t && t.keepPrivate) planning.resourceIds.privateTaskIds.push(id);
    }
  } else if (planning.resourceIds.taskIds.length === 0) {
    const { data: rows } = await client
      .from("event_tasks")
      .select("id,visibility,owner_type")
      .eq("venue_id", venueId)
      .eq("event_id", eventId)
      .order("sort_order")
      .limit(40);
    for (const row of rows ?? []) {
      const r = row as { id: string; visibility: string; owner_type: string };
      planning.resourceIds.taskIds.push(r.id);
      if (r.visibility === "coordinator_only" && r.owner_type === "couple") {
        planning.resourceIds.releaseTaskIds.push(r.id);
      }
      if (r.visibility === "coordinator_only" && r.owner_type === "coordinator") {
        planning.resourceIds.privateTaskIds.push(r.id);
      }
    }
  }
  planning.counts.tasks = planning.resourceIds.taskIds.length;

  // Timeline
  const timelineSource = await detectTimelineSource(client, venueId);
  planning.sources.timeline = timelineSource.source;
  const { count: existingTl } = await client
    .from("timeline_entries")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .eq("event_id", eventId);

  if (!existingTl || existingTl < 8) {
    const starter = TIMELINE_TEMPLATES.find((t) => t.id === "TL-01") ?? TIMELINE_TEMPLATES[0];
    const titles = (starter?.entries ?? [])
      .slice(0, 12)
      .map((e) => e.title);
    const fallbackTitles = [
      "Venue Access / Team Arrival",
      "Ceremony Setup",
      "Guest Arrival",
      "Ceremony Begins",
      "Cocktail Hour Begins",
      "Reception Begins",
      "Dinner Service Begins",
      "Toasts / Speeches",
      "First Dance",
      "Cake Cutting",
      "Last Call / Final Service",
      "Event Closeout",
    ];
    const useTitles = titles.length > 0 ? titles : fallbackTitles;
    let sort = 0;
    for (const title of useTitles) {
      const { data, error } = await client
        .from("timeline_entries")
        .insert({
          venue_id: venueId,
          event_id: eventId,
          title,
          description: "Practice Run wedding-day milestone",
          day_offset: 0,
          sort_order: sort++,
          audiences: [],
          owner: "venue",
          lock_state: "locked",
          status: "not_started",
        })
        .select("id")
        .single();
      if (!error && data) planning.resourceIds.timelineEntryIds.push((data as { id: string }).id);
    }
  }
  {
    const { data: rows } = await client
      .from("timeline_entries")
      .select("id")
      .eq("venue_id", venueId)
      .eq("event_id", eventId)
      .limit(50);
    planning.resourceIds.timelineEntryIds = (rows ?? []).map((r: { id: string }) => r.id);
  }
  planning.counts.timeline = planning.resourceIds.timelineEntryIds.length;

  // Documents — one prepared-for-share, one venue-only (idempotent)
  if (planning.resourceIds.sharedDocumentIds.length === 0) {
    const { data: sharedDoc } = await client
      .from("documents")
      .insert({
        venue_id: venueId,
        client_id: clientId,
        name: "Practice Welcome Packet",
        file_name: "practice-welcome.txt",
        file_size: 64,
        mime_type: "text/plain",
        storage_path: `practice/${venueId}/${run.id}/welcome.txt`,
        storage_url: PRACTICE_DOC_URL,
        category: "other",
        notes: "Practice-only document prepared for sharing. Not a real file delivery.",
        is_couple_visible: false,
        uploaded_by_type: "venue",
      })
      .select("id")
      .single();
    if (sharedDoc) planning.resourceIds.sharedDocumentIds.push((sharedDoc as { id: string }).id);
  }
  if (planning.resourceIds.privateDocumentIds.length === 0) {
    const { data: privateDoc } = await client
      .from("documents")
      .insert({
        venue_id: venueId,
        client_id: clientId,
        name: "Practice Internal Staff Notes",
        file_name: "practice-internal.txt",
        file_size: 64,
        mime_type: "text/plain",
        storage_path: `practice/${venueId}/${run.id}/internal.txt`,
        storage_url: PRACTICE_DOC_URL,
        category: "other",
        notes: "Venue-only practice document. Must remain hidden from Client perspective.",
        is_couple_visible: false,
        uploaded_by_type: "venue",
      })
      .select("id")
      .single();
    if (privateDoc) planning.resourceIds.privateDocumentIds.push((privateDoc as { id: string }).id);
  }
  planning.counts.documentsShared = planning.resourceIds.sharedDocumentIds.length;
  planning.counts.documentsPrivate = planning.resourceIds.privateDocumentIds.length;
  planning.sources.documents = "practice_fallback";

  // Questionnaire (draft until Share)
  const { data: existingQ } = await client
    .from("event_questionnaires")
    .select("id")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .eq("kind", "client_planning")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingQ?.id) {
    planning.resourceIds.questionnaireId = existingQ.id as string;
    planning.counts.questionnaires = 1;
  } else {
    const { data: questionnaire } = await client
      .from("event_questionnaires")
      .insert({
        venue_id: venueId,
        event_id: eventId,
        status: "draft",
        kind: "client_planning",
        included_fields: ["final_guest_count", "special_requests", "meal_notes"],
        required_fields: ["final_guest_count"],
        custom_fields: [
          {
            id: "celebration_colors",
            label: "Favorite celebration colors",
            type: "text",
            required: false,
          },
        ],
      })
      .select("id")
      .single();
    if (questionnaire) {
      planning.resourceIds.questionnaireId = (questionnaire as { id: string }).id;
      planning.counts.questionnaires = 1;
    }
  }
  planning.sources.questionnaire = "practice_fallback";

  // Event Order + Inventory shells
  const { data: existingEo } = await client
    .from("event_orders")
    .select("id")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (existingEo?.id) {
    planning.resourceIds.eventOrderId = existingEo.id as string;
  } else {
    const { data: eo } = await client
      .from("event_orders")
      .insert({
        venue_id: venueId,
        event_id: eventId,
        client_id: clientId,
        status: "open",
        revision: 1,
      })
      .select("id")
      .single();
    if (eo) planning.resourceIds.eventOrderId = (eo as { id: string }).id;
  }
  planning.sources.eventOrder = "practice_fallback";

  const { data: existingInv } = await client
    .from("event_inventory")
    .select("id")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (existingInv?.id) {
    planning.resourceIds.inventoryId = existingInv.id as string;
  } else {
    const { data: inv } = await client
      .from("event_inventory")
      .insert({ venue_id: venueId, event_id: eventId, status: "draft" })
      .select("id")
      .single();
    if (inv) planning.resourceIds.inventoryId = (inv as { id: string }).id;
  }
  planning.sources.inventory = "practice_fallback";

  // Wedding website draft — never published
  const { data: existingSite } = await client
    .from("couple_websites")
    .select("id")
    .eq("venue_id", venueId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (existingSite?.id) {
    planning.resourceIds.websiteId = existingSite.id as string;
  } else {
    const slug = `practice-maya-jordan-${run.id.slice(0, 8)}`;
    const { data: site } = await client
      .from("couple_websites")
      .insert({
        venue_id: venueId,
        client_id: clientId,
        slug,
        status: "draft",
        content: {
          hero: {
            headline: "Maya & Jordan",
            subheadline: "September 12, 2027",
          },
          story: {
            body: "Practice Run wedding website. Preview only — nothing is published publicly.",
          },
        },
      })
      .select("id")
      .single();
    if (site) planning.resourceIds.websiteId = (site as { id: string }).id;
  }
  planning.sources.website = "practice_fallback";

  planning.preparedAt = new Date().toISOString();
  return planning;
}

/**
 * Share prepared practice resources with the Client perspective.
 * Uses real visibility / release fields — no external delivery.
 */
export async function sharePracticePlanningResources(
  client: DbClient,
  venueId: string,
  run: PracticeRun,
  planning: PracticePlanningSnapshot,
): Promise<PracticePlanningSnapshot> {
  if (!run.sampleEventId || !run.sampleClientId) return planning;
  const next = { ...planning, resourceIds: { ...planning.resourceIds } };

  // Release selected coordinator_only couple tasks → client_visible
  if (next.resourceIds.releaseTaskIds.length > 0) {
    await client
      .from("event_tasks")
      .update({ visibility: "client_visible" })
      .eq("venue_id", venueId)
      .eq("event_id", run.sampleEventId)
      .in("id", next.resourceIds.releaseTaskIds);
  }

  // Keep private tasks private (explicit)
  if (next.resourceIds.privateTaskIds.length > 0) {
    await client
      .from("event_tasks")
      .update({ visibility: "coordinator_only" })
      .eq("venue_id", venueId)
      .eq("event_id", run.sampleEventId)
      .in("id", next.resourceIds.privateTaskIds);
  }

  // Share prepared documents; keep private docs hidden
  if (next.resourceIds.sharedDocumentIds.length > 0) {
    await client
      .from("documents")
      .update({ is_couple_visible: true })
      .eq("venue_id", venueId)
      .in("id", next.resourceIds.sharedDocumentIds);
  }
  if (next.resourceIds.privateDocumentIds.length > 0) {
    await client
      .from("documents")
      .update({ is_couple_visible: false })
      .eq("venue_id", venueId)
      .in("id", next.resourceIds.privateDocumentIds);
  }

  // Practice "send" questionnaire — in-app only, no email
  if (next.resourceIds.questionnaireId) {
    await client
      .from("event_questionnaires")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("venue_id", venueId)
      .eq("id", next.resourceIds.questionnaireId);
  }

  // Share Event Order with couple (shared_at only — no notifications)
  if (next.resourceIds.eventOrderId) {
    await client
      .from("event_orders")
      .update({ shared_at: new Date().toISOString() })
      .eq("venue_id", venueId)
      .eq("id", next.resourceIds.eventOrderId);
  }

  // Portal tasks require a released Client Planning application (real release gate).
  const { data: existingApp } = await client
    .from("event_playbook_applications")
    .select("id,released_at")
    .eq("venue_id", venueId)
    .eq("event_id", run.sampleEventId)
    .eq("kind", "client")
    .maybeSingle();
  if (existingApp?.id) {
    if (!(existingApp as { released_at: string | null }).released_at) {
      await client
        .from("event_playbook_applications")
        .update({ released_at: new Date().toISOString() })
        .eq("id", (existingApp as { id: string }).id)
        .eq("venue_id", venueId);
    }
  } else {
    await client.from("event_playbook_applications").insert({
      venue_id: venueId,
      event_id: run.sampleEventId,
      client_id: run.sampleClientId,
      template_id: null,
      template_name: "Practice Run — Client Planning",
      kind: "client",
      applied_at: new Date().toISOString(),
      released_at: new Date().toISOString(),
    });
  }

  next.sharedAt = new Date().toISOString();
  return next;
}
