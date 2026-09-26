/**
 * Client Choices Templates — data access. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  ChoicesTemplate,
  ChoicesTemplateGroup,
  ChoicesTemplateInput,
  ChoicesTemplateOption,
  ChoicesTemplateSection,
  ChoicesTemplateWithDetails,
} from "@/lib/client-choices-templates/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TRow = {
  id: string; venue_id: string; name: string; description: string | null;
  is_archived: boolean; created_at: string; updated_at: string;
};
type SRow = {
  id: string; template_id: string; venue_id: string; name: string;
  guidance: string | null; sort_order: number; created_at: string; updated_at: string;
};
type GRow = {
  id: string; template_id: string; venue_id: string; section_id: string | null;
  name: string; instructions: string | null; selection_mode: string;
  min_select: number; max_select: number | null; allow_quantity: boolean;
  sort_order: number; created_at: string; updated_at: string;
};
type ORow = {
  id: string; template_id: string; venue_id: string; group_id: string;
  offering_id: string | null; label: string; description: string | null;
  is_included: boolean; unit_price: number | null; sort_order: number;
  created_at: string; updated_at: string;
};

const mapT = (r: TRow): ChoicesTemplate => ({
  id: r.id, venueId: r.venue_id, name: r.name, description: r.description,
  isArchived: r.is_archived, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapS = (r: SRow): ChoicesTemplateSection => ({
  id: r.id, templateId: r.template_id, venueId: r.venue_id, name: r.name,
  guidance: r.guidance, sortOrder: r.sort_order,
});
const mapG = (r: GRow): ChoicesTemplateGroup => ({
  id: r.id, templateId: r.template_id, venueId: r.venue_id, sectionId: r.section_id,
  name: r.name, instructions: r.instructions,
  selectionMode: r.selection_mode === "multi" ? "multi" : "single",
  minSelect: r.min_select, maxSelect: r.max_select, allowQuantity: r.allow_quantity,
  sortOrder: r.sort_order,
});
const mapO = (r: ORow): ChoicesTemplateOption => ({
  id: r.id, templateId: r.template_id, venueId: r.venue_id, groupId: r.group_id,
  offeringId: r.offering_id, label: r.label, description: r.description,
  isIncluded: r.is_included,
  unitPrice: r.unit_price == null ? null : Number(r.unit_price),
  sortOrder: r.sort_order,
});

export async function getTemplates(client: DbClient, venueId: string, includeArchived = false): Promise<ChoicesTemplate[]> {
  let q = client.from("client_choices_templates").select("*").eq("venue_id", venueId);
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q.order("name");
  if (error) throw error;
  return ((data ?? []) as TRow[]).map(mapT);
}

export async function getTemplateWithDetails(
  client: DbClient, venueId: string, id: string,
): Promise<ChoicesTemplateWithDetails | null> {
  const [t, s, g, o] = await Promise.all([
    client.from("client_choices_templates").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<TRow>(),
    client.from("client_choices_template_sections").select("*").eq("template_id", id).order("sort_order"),
    client.from("client_choices_template_groups").select("*").eq("template_id", id).order("sort_order"),
    client.from("client_choices_template_options").select("*").eq("template_id", id).order("sort_order"),
  ]);
  if (t.error) throw t.error;
  if (s.error) throw s.error;
  if (g.error) throw g.error;
  if (o.error) throw o.error;
  if (!t.data) return null;
  return {
    ...mapT(t.data),
    sections: ((s.data ?? []) as SRow[]).map(mapS),
    groups: ((g.data ?? []) as GRow[]).map(mapG),
    options: ((o.data ?? []) as ORow[]).map(mapO),
  };
}

export async function insertTemplate(
  client: DbClient, venueId: string, input: ChoicesTemplateInput,
): Promise<string> {
  const { data, error } = await client.from("client_choices_templates")
    .insert({
      venue_id: venueId,
      name: input.name.trim(),
      description: input.description.trim() || null,
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateTemplate(
  client: DbClient, venueId: string, id: string, input: ChoicesTemplateInput,
): Promise<void> {
  const { error } = await client.from("client_choices_templates")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
    })
    .eq("id", id)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function setArchived(
  client: DbClient, venueId: string, id: string, archived: boolean,
): Promise<void> {
  const { error } = await client.from("client_choices_templates")
    .update({ is_archived: archived })
    .eq("id", id)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteTemplate(client: DbClient, venueId: string, id: string): Promise<void> {
  const { error } = await client.from("client_choices_templates")
    .delete()
    .eq("id", id)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function insertSection(
  client: DbClient, venueId: string, templateId: string, name: string, sortOrder: number,
): Promise<ChoicesTemplateSection> {
  const { data, error } = await client.from("client_choices_template_sections")
    .insert({
      venue_id: venueId, template_id: templateId, name: name.trim(), sort_order: sortOrder,
    })
    .select("*")
    .single<SRow>();
  if (error) throw error;
  return mapS(data);
}

export async function insertGroup(
  client: DbClient,
  venueId: string,
  templateId: string,
  input: {
    sectionId: string | null;
    name: string;
    instructions?: string;
    selectionMode: "single" | "multi";
    minSelect: number;
    maxSelect: number | null;
    allowQuantity: boolean;
    sortOrder: number;
  },
): Promise<ChoicesTemplateGroup> {
  const { data, error } = await client.from("client_choices_template_groups")
    .insert({
      venue_id: venueId,
      template_id: templateId,
      section_id: input.sectionId,
      name: input.name.trim(),
      instructions: input.instructions?.trim() || null,
      selection_mode: input.selectionMode,
      min_select: input.minSelect,
      max_select: input.maxSelect,
      allow_quantity: input.allowQuantity,
      sort_order: input.sortOrder,
    })
    .select("*")
    .single<GRow>();
  if (error) throw error;
  return mapG(data);
}

export async function insertOption(
  client: DbClient,
  venueId: string,
  templateId: string,
  input: {
    groupId: string;
    offeringId: string | null;
    label: string;
    description?: string;
    isIncluded: boolean;
    unitPrice: number | null;
    sortOrder: number;
  },
): Promise<ChoicesTemplateOption> {
  const { data, error } = await client.from("client_choices_template_options")
    .insert({
      venue_id: venueId,
      template_id: templateId,
      group_id: input.groupId,
      offering_id: input.offeringId,
      label: input.label.trim(),
      description: input.description?.trim() || null,
      is_included: input.isIncluded,
      unit_price: input.unitPrice,
      sort_order: input.sortOrder,
    })
    .select("*")
    .single<ORow>();
  if (error) throw error;
  return mapO(data);
}

export async function deleteGroup(client: DbClient, venueId: string, groupId: string): Promise<void> {
  const { error } = await client.from("client_choices_template_groups")
    .delete()
    .eq("id", groupId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteOption(client: DbClient, venueId: string, optionId: string): Promise<void> {
  const { error } = await client.from("client_choices_template_options")
    .delete()
    .eq("id", optionId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function nextSort(
  client: DbClient,
  table: "client_choices_template_sections" | "client_choices_template_groups" | "client_choices_template_options",
  parentCol: "template_id" | "group_id",
  parentId: string,
): Promise<number> {
  const { data } = await client.from(table)
    .select("sort_order")
    .eq(parentCol, parentId)
    .order("sort_order", { ascending: false })
    .limit(1);
  return ((data?.[0] as { sort_order?: number } | undefined)?.sort_order ?? -1) + 1;
}
