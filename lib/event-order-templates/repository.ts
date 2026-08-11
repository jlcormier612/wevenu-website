/**
 * Event Order Templates data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  EventOrderTemplate, EventOrderTemplateInput, EventOrderTemplateLine,
  EventOrderTemplateSection, EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = {
  id: string; venue_id: string; name: string; description: string | null;
  source_master_key: string | null;
  is_archived: boolean; created_at: string; updated_at: string;
};
type SectionRow = {
  id: string; template_id: string; venue_id: string; name: string; sort_order: number;
  created_at: string; updated_at: string;
};
type LineRow = {
  id: string; template_id: string; venue_id: string; section_id: string | null;
  description: string; quantity: number; unit_price: number; sort_order: number;
  created_at: string; updated_at: string;
};

const mapTemplate = (r: TemplateRow): EventOrderTemplate => ({
  id: r.id, venueId: r.venue_id, name: r.name, description: r.description,
  sourceMasterKey: r.source_master_key ?? null,
  isArchived: r.is_archived, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapSection = (r: SectionRow): EventOrderTemplateSection => ({
  id: r.id, templateId: r.template_id, venueId: r.venue_id, name: r.name,
  sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapLine = (r: LineRow): EventOrderTemplateLine => ({
  id: r.id, templateId: r.template_id, venueId: r.venue_id, sectionId: r.section_id,
  description: r.description, quantity: Number(r.quantity), unitPrice: Number(r.unit_price),
  sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
});

// ---- reads --------------------------------------------------------------------

export async function getTemplates(client: DbClient, venueId: string, includeArchived = false): Promise<EventOrderTemplate[]> {
  let q = client.from("event_order_templates").select("*").eq("venue_id", venueId);
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q.order("name");
  if (error) throw error;
  return (data as TemplateRow[]).map(mapTemplate);
}

/** Repository-level, reusable across domains — Event Orders' own service calls this directly with an already-open client/venueId, same pattern Event Inventory's ensureEventInventory uses for its own template lookup. */
export async function getTemplateWithDetails(client: DbClient, venueId: string, id: string): Promise<EventOrderTemplateWithDetails | null> {
  const [tRes, sRes, lRes] = await Promise.all([
    client.from("event_order_templates").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<TemplateRow>(),
    client.from("event_order_template_sections").select("*").eq("template_id", id).order("sort_order"),
    client.from("event_order_template_lines").select("*").eq("template_id", id).order("sort_order"),
  ]);
  if (tRes.error) throw tRes.error;
  if (sRes.error) throw sRes.error;
  if (lRes.error) throw lRes.error;
  if (!tRes.data) return null;
  return {
    ...mapTemplate(tRes.data),
    sections: (sRes.data as SectionRow[]).map(mapSection),
    lines: (lRes.data as LineRow[]).map(mapLine),
  };
}

// ---- template CRUD --------------------------------------------------------------

export async function insertTemplate(
  client: DbClient,
  venueId: string,
  input: EventOrderTemplateInput,
  opts?: { sourceMasterKey?: string | null },
): Promise<string> {
  const { data, error } = await client.from("event_order_templates")
    .insert({
      venue_id: venueId,
      name: input.name.trim(),
      description: input.description.trim() || null,
      source_master_key: opts?.sourceMasterKey ?? null,
    })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateTemplate(client: DbClient, venueId: string, id: string, input: EventOrderTemplateInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_order_templates") as any)
    .update({ name: input.name.trim(), description: input.description.trim() || null })
    .eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setTemplateArchived(client: DbClient, venueId: string, id: string, isArchived: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_order_templates") as any)
    .update({ is_archived: isArchived }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Work Package D6 lesson applied from day one — the RESTRICTIVE
 * Owner/Manager delete gate blocks a disallowed delete by matching zero
 * rows, not by raising an error; `.select("id")` surfaces that as an
 * honest denial instead of a false "deleted."
 */
export async function deleteTemplate(client: DbClient, venueId: string, id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await client.from("event_order_templates").delete().eq("id", id).eq("venue_id", venueId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    return { ok: false, message: "Only an Owner or Manager can delete this template." };
  }
  return { ok: true };
}

/** A fresh, independent, always-unarchived copy — same convention every other template type in this codebase already uses. */
export async function duplicateTemplate(client: DbClient, venueId: string, sourceId: string, newName: string): Promise<string> {
  const source = await getTemplateWithDetails(client, venueId, sourceId);
  if (!source) throw new Error("Template not found.");
  const newId = await insertTemplate(client, venueId, { name: newName, description: source.description ?? "" });

  const sectionIdMap = new Map<string, string>();
  for (const s of [...source.sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const created = await insertSection(client, venueId, newId, s.name, s.sortOrder);
    sectionIdMap.set(s.id, created.id);
  }
  for (const l of [...source.lines].sort((a, b) => a.sortOrder - b.sortOrder)) {
    await insertLine(client, venueId, newId, {
      sectionId: l.sectionId ? sectionIdMap.get(l.sectionId) ?? null : null,
      description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
    }, l.sortOrder);
  }
  return newId;
}

// ---- sections ---------------------------------------------------------------------

export async function insertSection(client: DbClient, venueId: string, templateId: string, name: string, sortOrder: number): Promise<EventOrderTemplateSection> {
  const { data, error } = await client.from("event_order_template_sections")
    .insert({ template_id: templateId, venue_id: venueId, name: name.trim(), sort_order: sortOrder })
    .select().single<SectionRow>();
  if (error) throw error;
  return mapSection(data);
}

/** Unsets section_id on every line first — removing a Section must never delete its lines, matching event_order_sections' own removeSection. */
export async function removeSection(client: DbClient, venueId: string, sectionId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: unlinkError } = await (client.from("event_order_template_lines") as any)
    .update({ section_id: null }).eq("section_id", sectionId).eq("venue_id", venueId);
  if (unlinkError) throw unlinkError;
  const { error } = await client.from("event_order_template_sections").delete().eq("id", sectionId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- lines ------------------------------------------------------------------------

export async function insertLine(
  client: DbClient, venueId: string, templateId: string,
  input: { sectionId: string | null; description: string; quantity: number; unitPrice: number },
  sortOrder: number,
): Promise<EventOrderTemplateLine> {
  const { data, error } = await client.from("event_order_template_lines")
    .insert({
      template_id: templateId, venue_id: venueId, section_id: input.sectionId,
      description: input.description.trim(), quantity: input.quantity, unit_price: input.unitPrice,
      sort_order: sortOrder,
    }).select().single<LineRow>();
  if (error) throw error;
  return mapLine(data);
}

export async function removeLine(client: DbClient, venueId: string, lineId: string): Promise<void> {
  const { error } = await client.from("event_order_template_lines").delete().eq("id", lineId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function nextSortOrder(client: DbClient, table: "event_order_template_sections" | "event_order_template_lines", templateId: string): Promise<number> {
  const { data } = await client.from(table).select("sort_order").eq("template_id", templateId).order("sort_order", { ascending: false }).limit(1);
  return ((data?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
}
