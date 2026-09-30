/**
 * Event Order Templates data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import {
  normalizeTemplatePricingModel,
  type TemplatePricingModel,
} from "@/lib/event-order-templates/offerings";
import type {
  EventOrderTemplate, EventOrderTemplateGroup, EventOrderTemplateInput,
  EventOrderTemplateLine, EventOrderTemplateOption,
  EventOrderTemplateSection, EventOrderTemplateSelectionMode,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = {
  id: string; venue_id: string; name: string; description: string | null;
  source_master_key: string | null;
  is_archived: boolean; created_at: string; updated_at: string;
};
type SectionRow = {
  id: string; template_id: string; venue_id: string; name: string;
  guidance: string | null; sort_order: number;
  created_at: string; updated_at: string;
};
type LineRow = {
  id: string; template_id: string; venue_id: string; section_id: string | null;
  description: string; description_detail: string | null;
  quantity: number; unit_price: number | null;
  pricing_model: string | null; unit: string | null;
  included_by_default: boolean | null; offering_id: string | null;
  sort_order: number;
  created_at: string; updated_at: string;
};
type GroupRow = {
  id: string; template_id: string; venue_id: string; section_id: string | null;
  name: string; instructions: string | null; selection_mode: string;
  min_select: number; max_select: number | null; allow_quantity: boolean;
  sort_order: number; created_at: string; updated_at: string;
};
type OptionRow = {
  id: string; template_id: string; venue_id: string; group_id: string;
  offering_id: string | null; label: string; description: string | null;
  is_included: boolean; unit_price: number | null; is_default: boolean;
  sort_order: number; created_at: string; updated_at: string;
};

const mapTemplate = (r: TemplateRow): EventOrderTemplate => ({
  id: r.id, venueId: r.venue_id, name: r.name, description: r.description,
  sourceMasterKey: r.source_master_key ?? null,
  isArchived: r.is_archived, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapSection = (r: SectionRow): EventOrderTemplateSection => ({
  id: r.id, templateId: r.template_id, venueId: r.venue_id, name: r.name,
  guidance: r.guidance ?? null,
  sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapLine = (r: LineRow): EventOrderTemplateLine => ({
  id: r.id, templateId: r.template_id, venueId: r.venue_id, sectionId: r.section_id,
  description: r.description,
  descriptionDetail: r.description_detail ?? null,
  quantity: Number(r.quantity),
  unitPrice: r.unit_price == null ? null : Number(r.unit_price),
  pricingModel: normalizeTemplatePricingModel(r.pricing_model),
  unit: r.unit ?? null,
  includedByDefault: Boolean(r.included_by_default),
  offeringId: r.offering_id ?? null,
  sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapGroup = (r: GroupRow): EventOrderTemplateGroup => ({
  id: r.id,
  templateId: r.template_id,
  venueId: r.venue_id,
  sectionId: r.section_id,
  name: r.name,
  instructions: r.instructions ?? null,
  selectionMode: r.selection_mode === "multi" ? "multi" : "single",
  minSelect: Number(r.min_select),
  maxSelect: r.max_select == null ? null : Number(r.max_select),
  allowQuantity: Boolean(r.allow_quantity),
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const mapOption = (r: OptionRow): EventOrderTemplateOption => ({
  id: r.id,
  templateId: r.template_id,
  venueId: r.venue_id,
  groupId: r.group_id,
  offeringId: r.offering_id ?? null,
  label: r.label,
  description: r.description ?? null,
  isIncluded: Boolean(r.is_included),
  unitPrice: r.unit_price == null ? null : Number(r.unit_price),
  isDefault: Boolean(r.is_default),
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type TemplateLineWrite = {
  sectionId: string | null;
  description: string;
  descriptionDetail: string | null;
  quantity: number;
  unitPrice: number | null;
  pricingModel: TemplatePricingModel;
  unit: string | null;
  includedByDefault: boolean;
  offeringId: string | null;
};

// ---- reads --------------------------------------------------------------------

export async function getTemplates(client: DbClient, venueId: string, includeArchived = false): Promise<EventOrderTemplate[]> {
  let q = client.from("event_order_templates").select("*").eq("venue_id", venueId);
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q.order("name");
  if (error) throw error;
  return (data as TemplateRow[]).map(mapTemplate);
}

export async function getTemplateWithDetails(client: DbClient, venueId: string, id: string): Promise<EventOrderTemplateWithDetails | null> {
  const [tRes, sRes, lRes, gRes, oRes] = await Promise.all([
    client.from("event_order_templates").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<TemplateRow>(),
    client.from("event_order_template_sections").select("*").eq("template_id", id).order("sort_order"),
    client.from("event_order_template_lines").select("*").eq("template_id", id).order("sort_order"),
    client.from("event_order_template_groups").select("*").eq("template_id", id).order("sort_order"),
    client.from("event_order_template_options").select("*").eq("template_id", id).order("sort_order"),
  ]);
  if (tRes.error) throw tRes.error;
  if (sRes.error) throw sRes.error;
  if (lRes.error) throw lRes.error;
  // Soft-fail until migration is applied (PostgREST schema cache / missing relation).
  const groupsMissing = Boolean(
    gRes.error && /does not exist|schema cache|Could not find the table/i.test(gRes.error.message ?? ""),
  );
  const optionsMissing = Boolean(
    oRes.error && /does not exist|schema cache|Could not find the table/i.test(oRes.error.message ?? ""),
  );
  if (gRes.error && !groupsMissing) throw gRes.error;
  if (oRes.error && !optionsMissing) throw oRes.error;
  if (!tRes.data) return null;
  return {
    ...mapTemplate(tRes.data),
    sections: (sRes.data as SectionRow[]).map(mapSection),
    lines: (lRes.data as LineRow[]).map(mapLine),
    groups: groupsMissing ? [] : (gRes.data as GroupRow[] ?? []).map(mapGroup),
    options: optionsMissing ? [] : (oRes.data as OptionRow[] ?? []).map(mapOption),
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

export async function deleteTemplate(client: DbClient, venueId: string, id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await client.from("event_order_templates").delete().eq("id", id).eq("venue_id", venueId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    return { ok: false, message: "Only an Owner or Manager can delete this template." };
  }
  return { ok: true };
}

export async function duplicateTemplate(client: DbClient, venueId: string, sourceId: string, newName: string): Promise<string> {
  const source = await getTemplateWithDetails(client, venueId, sourceId);
  if (!source) throw new Error("Template not found.");
  const newId = await insertTemplate(client, venueId, { name: newName, description: source.description ?? "" });

  const sectionIdMap = new Map<string, string>();
  for (const s of [...source.sections].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const created = await insertSection(client, venueId, newId, s.name, s.sortOrder, s.guidance);
    sectionIdMap.set(s.id, created.id);
  }
  for (const l of [...source.lines].sort((a, b) => a.sortOrder - b.sortOrder)) {
    await insertLine(client, venueId, newId, {
      sectionId: l.sectionId ? sectionIdMap.get(l.sectionId) ?? null : null,
      description: l.description,
      descriptionDetail: l.descriptionDetail,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      pricingModel: l.pricingModel,
      unit: l.unit,
      includedByDefault: l.includedByDefault,
      offeringId: l.offeringId,
    }, l.sortOrder);
  }
  const groupIdMap = new Map<string, string>();
  for (const g of [...source.groups].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const created = await insertGroup(client, venueId, newId, {
      sectionId: g.sectionId ? sectionIdMap.get(g.sectionId) ?? null : null,
      name: g.name,
      instructions: g.instructions,
      selectionMode: g.selectionMode,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      allowQuantity: g.allowQuantity,
    }, g.sortOrder);
    groupIdMap.set(g.id, created.id);
  }
  for (const o of [...source.options].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const newGroupId = groupIdMap.get(o.groupId);
    if (!newGroupId) continue;
    await insertOption(client, venueId, newId, {
      groupId: newGroupId,
      offeringId: o.offeringId,
      label: o.label,
      description: o.description,
      isIncluded: o.isIncluded,
      unitPrice: o.unitPrice,
      isDefault: o.isDefault,
    }, o.sortOrder);
  }
  return newId;
}

// ---- sections ---------------------------------------------------------------------

export async function insertSection(
  client: DbClient, venueId: string, templateId: string, name: string, sortOrder: number,
  guidance: string | null = null,
): Promise<EventOrderTemplateSection> {
  const { data, error } = await client.from("event_order_template_sections")
    .insert({
      template_id: templateId, venue_id: venueId, name: name.trim(), sort_order: sortOrder,
      guidance: guidance?.trim() || null,
    })
    .select().single<SectionRow>();
  if (error) throw error;
  return mapSection(data);
}

export async function updateSection(
  client: DbClient, venueId: string, sectionId: string,
  input: { name?: string; guidance?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.guidance !== undefined) patch.guidance = input.guidance?.trim() || null;
  if (Object.keys(patch).length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_order_template_sections") as any)
    .update(patch)
    .eq("id", sectionId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateSectionGuidance(
  client: DbClient, venueId: string, sectionId: string, guidance: string | null,
): Promise<void> {
  await updateSection(client, venueId, sectionId, { guidance });
}

export async function reorderRows(
  client: DbClient,
  table:
    | "event_order_template_sections"
    | "event_order_template_lines"
    | "event_order_template_groups"
    | "event_order_template_options",
  venueId: string,
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    if (!id) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (client.from(table) as any)
      .update({ sort_order: i })
      .eq("id", id).eq("venue_id", venueId);
    if (error) throw error;
  }
}

/** Removes the section and its template offerings / groups. Event Orders already created are untouched. */
export async function removeSection(client: DbClient, venueId: string, sectionId: string): Promise<void> {
  const { error: linesError } = await client.from("event_order_template_lines")
    .delete().eq("section_id", sectionId).eq("venue_id", venueId);
  if (linesError) throw linesError;
  // Options cascade via groups; delete groups attached to this section.
  const { error: groupsError } = await client.from("event_order_template_groups")
    .delete().eq("section_id", sectionId).eq("venue_id", venueId);
  if (
    groupsError
    && !/does not exist|schema cache|Could not find the table/i.test(groupsError.message ?? "")
  ) {
    throw groupsError;
  }
  const { error } = await client.from("event_order_template_sections").delete().eq("id", sectionId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- lines ------------------------------------------------------------------------

export async function insertLine(
  client: DbClient, venueId: string, templateId: string,
  input: TemplateLineWrite,
  sortOrder: number,
): Promise<EventOrderTemplateLine> {
  const { data, error } = await client.from("event_order_template_lines")
    .insert({
      template_id: templateId, venue_id: venueId, section_id: input.sectionId,
      description: input.description.trim(),
      description_detail: input.descriptionDetail?.trim() || null,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      pricing_model: input.pricingModel,
      unit: input.unit?.trim() || null,
      included_by_default: input.includedByDefault,
      offering_id: input.offeringId,
      sort_order: sortOrder,
    }).select().single<LineRow>();
  if (error) throw error;
  return mapLine(data);
}

export async function updateLine(
  client: DbClient, venueId: string, lineId: string, input: TemplateLineWrite,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_order_template_lines") as any)
    .update({
      section_id: input.sectionId,
      description: input.description.trim(),
      description_detail: input.descriptionDetail?.trim() || null,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      pricing_model: input.pricingModel,
      unit: input.unit?.trim() || null,
      included_by_default: input.includedByDefault,
      offering_id: input.offeringId,
    })
    .eq("id", lineId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function removeLine(client: DbClient, venueId: string, lineId: string): Promise<void> {
  const { error } = await client.from("event_order_template_lines").delete().eq("id", lineId).eq("venue_id", venueId);
  if (error) throw error;
}

export type TemplateGroupWrite = {
  sectionId: string | null;
  name: string;
  instructions: string | null;
  selectionMode: EventOrderTemplateSelectionMode;
  minSelect: number;
  maxSelect: number | null;
  allowQuantity: boolean;
};

export type TemplateOptionWrite = {
  groupId: string;
  offeringId: string | null;
  label: string;
  description: string | null;
  isIncluded: boolean;
  unitPrice: number | null;
  isDefault: boolean;
};

export async function insertGroup(
  client: DbClient,
  venueId: string,
  templateId: string,
  input: TemplateGroupWrite,
  sortOrder: number,
): Promise<EventOrderTemplateGroup> {
  const { data, error } = await client.from("event_order_template_groups")
    .insert({
      template_id: templateId,
      venue_id: venueId,
      section_id: input.sectionId,
      name: input.name.trim(),
      instructions: input.instructions?.trim() || null,
      selection_mode: input.selectionMode,
      min_select: input.minSelect,
      max_select: input.maxSelect,
      allow_quantity: input.allowQuantity,
      sort_order: sortOrder,
    })
    .select()
    .single<GroupRow>();
  if (error) throw error;
  return mapGroup(data);
}

export async function updateGroup(
  client: DbClient,
  venueId: string,
  groupId: string,
  input: TemplateGroupWrite,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_order_template_groups") as any)
    .update({
      section_id: input.sectionId,
      name: input.name.trim(),
      instructions: input.instructions?.trim() || null,
      selection_mode: input.selectionMode,
      min_select: input.minSelect,
      max_select: input.maxSelect,
      allow_quantity: input.allowQuantity,
    })
    .eq("id", groupId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function removeGroup(client: DbClient, venueId: string, groupId: string): Promise<void> {
  const { error } = await client.from("event_order_template_groups")
    .delete().eq("id", groupId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function insertOption(
  client: DbClient,
  venueId: string,
  templateId: string,
  input: TemplateOptionWrite,
  sortOrder: number,
): Promise<EventOrderTemplateOption> {
  const { data, error } = await client.from("event_order_template_options")
    .insert({
      template_id: templateId,
      venue_id: venueId,
      group_id: input.groupId,
      offering_id: input.offeringId,
      label: input.label.trim(),
      description: input.description?.trim() || null,
      is_included: input.isIncluded,
      unit_price: input.isIncluded ? 0 : input.unitPrice,
      is_default: input.isDefault,
      sort_order: sortOrder,
    })
    .select()
    .single<OptionRow>();
  if (error) throw error;
  return mapOption(data);
}

export async function updateOption(
  client: DbClient,
  venueId: string,
  optionId: string,
  input: TemplateOptionWrite,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_order_template_options") as any)
    .update({
      group_id: input.groupId,
      offering_id: input.offeringId,
      label: input.label.trim(),
      description: input.description?.trim() || null,
      is_included: input.isIncluded,
      unit_price: input.isIncluded ? 0 : input.unitPrice,
      is_default: input.isDefault,
    })
    .eq("id", optionId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function removeOption(client: DbClient, venueId: string, optionId: string): Promise<void> {
  const { error } = await client.from("event_order_template_options")
    .delete().eq("id", optionId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function nextSortOrder(
  client: DbClient,
  table:
    | "event_order_template_sections"
    | "event_order_template_lines"
    | "event_order_template_groups"
    | "event_order_template_options",
  templateId: string,
  scopeId?: string | null,
): Promise<number> {
  let q = client.from(table).select("sort_order").eq("template_id", templateId);
  if (table === "event_order_template_lines" && scopeId) {
    q = q.eq("section_id", scopeId);
  }
  if (table === "event_order_template_options" && scopeId) {
    q = q.eq("group_id", scopeId);
  }
  if (table === "event_order_template_groups" && scopeId) {
    q = q.eq("section_id", scopeId);
  }
  const { data } = await q.order("sort_order", { ascending: false }).limit(1);
  return ((data?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
}
