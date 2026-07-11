import { createClient } from "@/integrations/supabase/server";
import type { TimelineAudience } from "@/lib/timeline/types";
import type {
  TimelineTemplate,
  TimelineTemplateItem,
  TimelineTemplateItemInput,
  TimelineTemplateWithStats,
} from "@/lib/timeline-templates/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = { id: string; venue_id: string; name: string; event_type: string | null; space_id: string | null; is_default: boolean; is_archived: boolean; created_at: string; updated_at: string; };
type ItemRow = { id: string; template_id: string; venue_id: string; title: string; description: string | null; notes: string | null; time_of_day: string | null; minutes_offset: number | null; audiences: string[]; sort_order: number; created_at: string; updated_at: string; };

const mapTemplate = (r: TemplateRow): TimelineTemplate => ({
  id: r.id, venueId: r.venue_id, name: r.name, eventType: r.event_type, spaceId: r.space_id,
  isDefault: r.is_default, isArchived: r.is_archived, createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapItem = (r: ItemRow): TimelineTemplateItem => ({
  id: r.id, templateId: r.template_id, venueId: r.venue_id, title: r.title, description: r.description,
  notes: r.notes, timeOfDay: r.time_of_day, minutesOffset: r.minutes_offset,
  audiences: r.audiences as TimelineAudience[], sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
});

// ---- Templates ---------------------------------------------------------------

// Archived excluded by default, same shape as Planning Templates' getTemplates()
// — any future booking-apply flow that calls this unchanged gets Requirement
// 7's behavior for free.
export async function getTemplates(client: DbClient, venueId: string, opts?: { includeArchived?: boolean }): Promise<TimelineTemplate[]> {
  let query = client.from("timeline_templates").select("*").eq("venue_id", venueId);
  if (!opts?.includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query.order("name");
  if (error) throw error;
  return (data as TemplateRow[]).map(mapTemplate);
}

export async function getTemplate(client: DbClient, venueId: string, id: string): Promise<TimelineTemplate | null> {
  const { data } = await client.from("timeline_templates").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<TemplateRow>();
  return data ? mapTemplate(data) : null;
}

// Library card grid needs the space name and item count alongside every
// template. Flat-row fetches + JS grouping/mapping, not a PostgREST embedded
// select — this codebase has hit real bugs from untested embedded syntax.
export async function getTemplatesWithStats(client: DbClient, venueId: string): Promise<TimelineTemplateWithStats[]> {
  const [{ data: templateRows, error: templateError }, { data: itemRows, error: itemError }, { data: spaceRows, error: spaceError }] = await Promise.all([
    client.from("timeline_templates").select("*").eq("venue_id", venueId).order("name"),
    client.from("timeline_template_items").select("template_id").eq("venue_id", venueId),
    client.from("venue_spaces").select("id, name").eq("venue_id", venueId),
  ]);
  if (templateError) throw templateError;
  if (itemError) throw itemError;
  if (spaceError) throw spaceError;

  const itemCounts = new Map<string, number>();
  for (const row of itemRows as { template_id: string }[]) itemCounts.set(row.template_id, (itemCounts.get(row.template_id) ?? 0) + 1);

  const spaceNames = new Map<string, string>();
  for (const row of spaceRows as { id: string; name: string }[]) spaceNames.set(row.id, row.name);

  return (templateRows as TemplateRow[]).map((r) => ({
    ...mapTemplate(r),
    spaceName: r.space_id ? spaceNames.get(r.space_id) ?? null : null,
    itemCount: itemCounts.get(r.id) ?? 0,
  }));
}

export async function insertTemplate(client: DbClient, venueId: string, name: string, eventType: string | null, spaceId: string | null): Promise<string> {
  const { data, error } = await client.from("timeline_templates").insert({ venue_id: venueId, name: name.trim(), event_type: eventType || null, space_id: spaceId || null }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function renameTemplate(client: DbClient, venueId: string, id: string, name: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("timeline_templates") as any).update({ name: name.trim() }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

// Clear-then-set within the same (venue, event_type, space) group so the
// unique partial index (timeline_templates_default) never sees two defaults
// at once.
export async function setTemplateDefault(client: DbClient, venueId: string, id: string, eventType: string | null, spaceId: string | null): Promise<void> {
  let clearQuery = client.from("timeline_templates").update({ is_default: false } as never).eq("venue_id", venueId).neq("id", id);
  clearQuery = eventType ? clearQuery.eq("event_type", eventType) : clearQuery.is("event_type", null);
  clearQuery = spaceId ? clearQuery.eq("space_id", spaceId) : clearQuery.is("space_id", null);
  const { error: clearError } = await clearQuery;
  if (clearError) throw clearError;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("timeline_templates") as any).update({ is_default: true }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setTemplateArchived(client: DbClient, venueId: string, id: string, isArchived: boolean): Promise<void> {
  // Archiving can't leave a template as the default — it would disappear
  // from apply flows while still being auto-selected.
  const patch: Record<string, unknown> = { is_archived: isArchived };
  if (isArchived) patch.is_default = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("timeline_templates") as any).update(patch).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

/** Clone a template's items into a brand-new template — same event type and space as the source. */
export async function duplicateTemplateInto(client: DbClient, venueId: string, sourceTemplateId: string, newName: string): Promise<string> {
  const source = await getTemplate(client, venueId, sourceTemplateId);
  if (!source) throw new Error("Template not found.");

  const newTemplateId = await insertTemplate(client, venueId, newName, source.eventType, source.spaceId);
  const items = await getItems(client, venueId, sourceTemplateId);

  for (const item of items) {
    await insertItem(client, venueId, newTemplateId, {
      title: item.title, description: item.description, notes: item.notes,
      timeOfDay: item.timeOfDay, minutesOffset: item.minutesOffset,
      audiences: item.audiences, sortOrder: item.sortOrder,
    });
  }

  return newTemplateId;
}

// ---- Items ---------------------------------------------------------------

export async function getItems(client: DbClient, venueId: string, templateId: string): Promise<TimelineTemplateItem[]> {
  const { data, error } = await client.from("timeline_template_items").select("*").eq("template_id", templateId).eq("venue_id", venueId).order("sort_order");
  if (error) throw error;
  return (data as ItemRow[]).map(mapItem);
}

export async function insertItem(client: DbClient, venueId: string, templateId: string, input: TimelineTemplateItemInput): Promise<string> {
  const { data, error } = await client.from("timeline_template_items").insert({
    template_id: templateId, venue_id: venueId, title: input.title.trim(),
    description: input.description?.trim() || null, notes: input.notes?.trim() || null,
    time_of_day: input.timeOfDay || null, minutes_offset: input.minutesOffset,
    audiences: input.audiences, sort_order: input.sortOrder,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateItem(client: DbClient, venueId: string, itemId: string, patch: Partial<TimelineTemplateItemInput>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title.trim();
  if (patch.description !== undefined) row.description = patch.description?.trim() || null;
  if (patch.notes !== undefined) row.notes = patch.notes?.trim() || null;
  if (patch.timeOfDay !== undefined) row.time_of_day = patch.timeOfDay || null;
  if (patch.minutesOffset !== undefined) row.minutes_offset = patch.minutesOffset;
  if (patch.audiences !== undefined) row.audiences = patch.audiences;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("timeline_template_items") as any).update(row).eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteItem(client: DbClient, venueId: string, itemId: string): Promise<void> {
  const { error } = await client.from("timeline_template_items").delete().eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function reorderItems(client: DbClient, venueId: string, orderedItemIds: string[]): Promise<void> {
  for (let i = 0; i < orderedItemIds.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from("timeline_template_items") as any).update({ sort_order: i }).eq("id", orderedItemIds[i]).eq("venue_id", venueId);
    if (error) throw error;
  }
}
