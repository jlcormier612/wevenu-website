/**
 * Vendor task template packs — named lists of items applied into event-scoped
 * vendor_tasks. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { offsetDate } from "@/lib/playbooks/due-dates";
import { parseDaysOffsetInput } from "@/lib/vendor-task-templates/presets";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorEventDetail, getVendorEvents } from "@/lib/vendor-events/service";
import { deriveCompletionAuthority } from "@/lib/vendor-tasks/completion-authority";
import type { VendorActionResult } from "@/lib/vendors/types";
import type {
  VendorTaskTemplate,
  VendorTaskTemplateAttachment,
  VendorTaskTemplateItem,
  VendorTaskTemplateItemInput,
  VendorTaskTemplatePackInput,
} from "@/lib/vendor-task-templates/types";

type Sb = Awaited<ReturnType<typeof createClient>>;

async function withVendorManage<T>(
  fn: (supabase: Sb, vendorId: string) => Promise<T>,
): Promise<T | VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  if (!["owner", "manager"].includes(vendorUser.role)) {
    return { ok: false, message: "Insufficient permissions." };
  }
  const supabase = await createClient();
  return fn(supabase, vendorUser.vendorId);
}

async function withVendor<T>(
  fn: (supabase: Sb, vendorId: string) => Promise<T>,
): Promise<T | VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  const supabase = await createClient();
  return fn(supabase, vendorUser.vendorId);
}

function parseDaysOffset(raw: string): number | null {
  return parseDaysOffsetInput(raw);
}

function mapAttachment(r: Record<string, unknown>): VendorTaskTemplateAttachment {
  return {
    id:          r.id as string,
    itemId:      r.item_id as string,
    name:        r.name as string,
    storagePath: r.storage_path as string,
    storageUrl:  r.storage_url as string,
    mimeType:    (r.mime_type as string | null) ?? null,
    fileSize:    r.file_size != null ? Number(r.file_size) : null,
    sortOrder:   (r.sort_order as number) ?? 0,
  };
}

function mapItem(
  r: Record<string, unknown>,
  attachments: VendorTaskTemplateAttachment[],
): VendorTaskTemplateItem {
  return {
    id:          r.id as string,
    templateId:  r.template_id as string,
    title:       r.title as string,
    daysOffset:  (r.days_offset as number | null) ?? null,
    notes:       (r.notes as string | null) ?? null,
    actionType:  r.action_type === "share_timeline" ? "share_timeline" : null,
    sortOrder:   (r.sort_order as number) ?? 0,
    createdAt:   r.created_at as string,
    updatedAt:   r.updated_at as string,
    attachments,
  };
}

function mapPack(
  r: Record<string, unknown>,
  items: VendorTaskTemplateItem[],
): VendorTaskTemplate {
  const pkg = r.vendor_packages as { name?: string } | null | undefined;
  return {
    id:          r.id as string,
    vendorId:    r.vendor_id as string,
    name:        r.name as string,
    notes:       (r.notes as string | null) ?? null,
    packageId:   (r.package_id as string | null) ?? null,
    eventType:   (r.event_type as string | null) ?? null,
    isActive:    Boolean(r.is_active),
    sortOrder:   (r.sort_order as number) ?? 0,
    createdAt:   r.created_at as string,
    updatedAt:   r.updated_at as string,
    packageName: pkg?.name ?? null,
    items,
  };
}

async function assertPackOwned(supabase: Sb, vendorId: string, packId: string): Promise<boolean> {
  const { data } = await supabase
    .from("vendor_task_templates")
    .select("id")
    .eq("id", packId)
    .eq("vendor_id", vendorId)
    .maybeSingle();
  return Boolean(data);
}

async function assertItemOwned(
  supabase: Sb,
  vendorId: string,
  itemId: string,
): Promise<{ templateId: string } | null> {
  const { data: item } = await supabase
    .from("vendor_task_template_items")
    .select("id, template_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return null;
  const ok = await assertPackOwned(supabase, vendorId, item.template_id as string);
  if (!ok) return null;
  return { templateId: item.template_id as string };
}

export async function getVendorTaskTemplates(
  vendorId: string,
  opts?: { activeOnly?: boolean },
): Promise<VendorTaskTemplate[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  let query = supabase
    .from("vendor_task_templates")
    .select("*, vendor_packages(name)")
    .eq("vendor_id", vendorId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (opts?.activeOnly) query = query.eq("is_active", true);

  const { data: packs } = await query;
  const packRows = (packs ?? []) as Record<string, unknown>[];
  if (packRows.length === 0) return [];

  const packIds = packRows.map((p) => p.id as string);
  const { data: itemRows } = await supabase
    .from("vendor_task_template_items")
    .select("*")
    .in("template_id", packIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const items = (itemRows ?? []) as Record<string, unknown>[];
  const itemIds = items.map((i) => i.id as string);

  let attachmentsByItem = new Map<string, VendorTaskTemplateAttachment[]>();
  if (itemIds.length > 0) {
    const { data: attRows } = await supabase
      .from("vendor_task_template_item_attachments")
      .select("*")
      .in("item_id", itemIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    attachmentsByItem = new Map();
    for (const raw of (attRows ?? []) as Record<string, unknown>[]) {
      const att = mapAttachment(raw);
      const list = attachmentsByItem.get(att.itemId) ?? [];
      list.push(att);
      attachmentsByItem.set(att.itemId, list);
    }
  }

  const itemsByPack = new Map<string, VendorTaskTemplateItem[]>();
  for (const raw of items) {
    const item = mapItem(raw, attachmentsByItem.get(raw.id as string) ?? []);
    const list = itemsByPack.get(item.templateId) ?? [];
    list.push(item);
    itemsByPack.set(item.templateId, list);
  }

  return packRows.map((p) => mapPack(p, itemsByPack.get(p.id as string) ?? []));
}

export async function createVendorTaskTemplate(
  input: VendorTaskTemplatePackInput,
): Promise<VendorActionResult & { id?: string }> {
  if (!input.name.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVendorManage(async (supabase, vendorId) => {
    const { data, error } = await supabase
      .from("vendor_task_templates")
      .insert({
        vendor_id:  vendorId,
        name:       input.name.trim(),
        notes:      input.notes.trim() || null,
        package_id: input.packageId.trim() || null,
        event_type: input.eventType.trim() || null,
        is_active:  input.isActive,
      })
      .select("id")
      .single();
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true, id: (data as { id: string }).id } as VendorActionResult & { id: string };
  });
  return result as VendorActionResult & { id?: string };
}

export async function updateVendorTaskTemplate(
  id: string,
  input: VendorTaskTemplatePackInput,
): Promise<VendorActionResult> {
  if (!input.name.trim()) return { ok: false, message: "Template name is required." };
  const result = await withVendorManage(async (supabase, vendorId) => {
    const { error } = await supabase
      .from("vendor_task_templates")
      .update({
        name:       input.name.trim(),
        notes:      input.notes.trim() || null,
        package_id: input.packageId.trim() || null,
        event_type: input.eventType.trim() || null,
        is_active:  input.isActive,
      })
      .eq("id", id)
      .eq("vendor_id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function deleteVendorTaskTemplate(id: string): Promise<VendorActionResult> {
  const result = await withVendorManage(async (supabase, vendorId) => {
    const { error } = await supabase
      .from("vendor_task_templates")
      .delete()
      .eq("id", id)
      .eq("vendor_id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function toggleVendorTaskTemplate(
  id: string,
  isActive: boolean,
): Promise<VendorActionResult> {
  const result = await withVendorManage(async (supabase, vendorId) => {
    const { error } = await supabase
      .from("vendor_task_templates")
      .update({ is_active: isActive })
      .eq("id", id)
      .eq("vendor_id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function createVendorTaskTemplateItem(
  templateId: string,
  input: VendorTaskTemplateItemInput,
): Promise<VendorActionResult & { id?: string }> {
  if (!input.title.trim()) return { ok: false, message: "Task title is required." };
  const result = await withVendorManage(async (supabase, vendorId) => {
    if (!(await assertPackOwned(supabase, vendorId, templateId))) {
      return { ok: false, message: "Template not found." } as VendorActionResult;
    }
    const { data: maxRow } = await supabase
      .from("vendor_task_template_items")
      .select("sort_order")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;
    const { data, error } = await supabase
      .from("vendor_task_template_items")
      .insert({
        template_id: templateId,
        title:       input.title.trim(),
        days_offset: parseDaysOffset(input.daysOffset),
        notes:       input.notes.trim() || null,
        action_type: input.actionType === "share_timeline" ? "share_timeline" : null,
        sort_order:  nextOrder,
      })
      .select("id")
      .single();
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true, id: (data as { id: string }).id } as VendorActionResult & { id: string };
  });
  return result as VendorActionResult & { id?: string };
}

export async function updateVendorTaskTemplateItem(
  itemId: string,
  input: VendorTaskTemplateItemInput,
): Promise<VendorActionResult> {
  if (!input.title.trim()) return { ok: false, message: "Task title is required." };
  const result = await withVendorManage(async (supabase, vendorId) => {
    const owned = await assertItemOwned(supabase, vendorId, itemId);
    if (!owned) return { ok: false, message: "Task not found." } as VendorActionResult;
    const { error } = await supabase
      .from("vendor_task_template_items")
      .update({
        title:       input.title.trim(),
        days_offset: parseDaysOffset(input.daysOffset),
        notes:       input.notes.trim() || null,
        action_type: input.actionType === "share_timeline" ? "share_timeline" : null,
      })
      .eq("id", itemId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function deleteVendorTaskTemplateItem(itemId: string): Promise<VendorActionResult> {
  const result = await withVendorManage(async (supabase, vendorId) => {
    const owned = await assertItemOwned(supabase, vendorId, itemId);
    if (!owned) return { ok: false, message: "Task not found." } as VendorActionResult;
    const { error } = await supabase
      .from("vendor_task_template_items")
      .delete()
      .eq("id", itemId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function reorderVendorTaskTemplateItems(
  templateId: string,
  orderedItemIds: string[],
): Promise<VendorActionResult> {
  const result = await withVendorManage(async (supabase, vendorId) => {
    if (!(await assertPackOwned(supabase, vendorId, templateId))) {
      return { ok: false, message: "Template not found." } as VendorActionResult;
    }
    for (let i = 0; i < orderedItemIds.length; i++) {
      const { error } = await supabase
        .from("vendor_task_template_items")
        .update({ sort_order: i })
        .eq("id", orderedItemIds[i])
        .eq("template_id", templateId);
      if (error) return { ok: false, message: error.message } as VendorActionResult;
    }
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function addVendorTaskTemplateItemAttachment(opts: {
  itemId: string;
  name: string;
  storagePath: string;
  storageUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
}): Promise<VendorActionResult & { id?: string }> {
  if (!opts.name.trim() || !opts.storagePath || !opts.storageUrl) {
    return { ok: false, message: "Attachment details are required." };
  }
  const result = await withVendorManage(async (supabase, vendorId) => {
    const owned = await assertItemOwned(supabase, vendorId, opts.itemId);
    if (!owned) return { ok: false, message: "Task not found." } as VendorActionResult;
    const { data: maxRow } = await supabase
      .from("vendor_task_template_item_attachments")
      .select("sort_order")
      .eq("item_id", opts.itemId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;
    const { data, error } = await supabase
      .from("vendor_task_template_item_attachments")
      .insert({
        item_id:      opts.itemId,
        name:         opts.name.trim(),
        storage_path: opts.storagePath,
        storage_url:  opts.storageUrl,
        mime_type:    opts.mimeType ?? null,
        file_size:    opts.fileSize ?? null,
        sort_order:   nextOrder,
      })
      .select("id")
      .single();
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true, id: (data as { id: string }).id } as VendorActionResult & { id: string };
  });
  return result as VendorActionResult & { id?: string };
}

export async function removeVendorTaskTemplateItemAttachment(
  attachmentId: string,
): Promise<VendorActionResult> {
  const result = await withVendorManage(async (supabase, vendorId) => {
    const { data: att } = await supabase
      .from("vendor_task_template_item_attachments")
      .select("id, item_id")
      .eq("id", attachmentId)
      .maybeSingle();
    if (!att) return { ok: false, message: "Attachment not found." } as VendorActionResult;
    const owned = await assertItemOwned(supabase, vendorId, att.item_id as string);
    if (!owned) return { ok: false, message: "Attachment not found." } as VendorActionResult;
    const { error } = await supabase
      .from("vendor_task_template_item_attachments")
      .delete()
      .eq("id", attachmentId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

/**
 * Clone selected template items into vendor_tasks for an event.
 * Editing templates later does not rewrite these rows.
 */
export async function applyVendorTaskTemplates(opts: {
  assignmentId?: string;
  eventId?: string;
  /** Preferred: individual item ids within packs. */
  itemIds?: string[];
  /** Legacy: treat as pack ids and apply all items in those packs. */
  templateIds?: string[];
  /** Share applied tasks with the couple (default private). */
  coupleVisibility?: "private" | "visible" | "owned";
  /** Phase 2: owned + vendor_confirm dual-state for applied tasks. */
  requireVendorConfirmation?: boolean;
}): Promise<VendorActionResult & { createdCount?: number; warnedNoEventDate?: boolean }> {
  let itemIds = [...new Set((opts.itemIds ?? []).filter(Boolean))];

  const result = await withVendor(async (supabase, vendorId) => {
    let eventId = opts.eventId?.trim() || "";
    let eventDate: string | null = null;
    let assignmentId = opts.assignmentId?.trim() || "";

    if (assignmentId) {
      const detail = await getVendorEventDetail(assignmentId, vendorId);
      if (!detail) return { ok: false, message: "Event not found." } as VendorActionResult;
      eventId = detail.eventId;
      eventDate = detail.eventDate;
    } else if (eventId) {
      const events = await getVendorEvents();
      const match = events.find((e) => e.eventId === eventId);
      if (!match) return { ok: false, message: "Event not found." } as VendorActionResult;
      assignmentId = match.assignmentId;
      eventDate = match.eventDate;
    } else {
      return { ok: false, message: "Event is required." } as VendorActionResult;
    }

    // Expand pack ids → all active items when only templateIds provided.
    if (itemIds.length === 0 && opts.templateIds?.length) {
      const packIds = [...new Set(opts.templateIds.filter(Boolean))];
      const { data: packs } = await supabase
        .from("vendor_task_templates")
        .select("id")
        .eq("vendor_id", vendorId)
        .eq("is_active", true)
        .in("id", packIds);
      const validPackIds = ((packs ?? []) as { id: string }[]).map((p) => p.id);
      if (validPackIds.length === 0) {
        return { ok: false, message: "No matching active templates found." } as VendorActionResult;
      }
      const { data: packItems } = await supabase
        .from("vendor_task_template_items")
        .select("id")
        .in("template_id", validPackIds)
        .order("sort_order", { ascending: true });
      itemIds = ((packItems ?? []) as { id: string }[]).map((i) => i.id);
    }

    if (itemIds.length === 0) {
      return { ok: false, message: "Select at least one task." } as VendorActionResult;
    }

    const { data: items, error: itemError } = await supabase
      .from("vendor_task_template_items")
      .select("*, vendor_task_templates!inner(id, vendor_id, is_active)")
      .in("id", itemIds);
    if (itemError) return { ok: false, message: itemError.message } as VendorActionResult;

    const owned = ((items ?? []) as Record<string, unknown>[]).filter((row) => {
      const pack = row.vendor_task_templates as { vendor_id: string; is_active: boolean };
      return pack.vendor_id === vendorId && pack.is_active;
    });
    const byId = new Map(owned.map((r) => [r.id as string, r]));
    const ordered = itemIds.map((id) => byId.get(id)).filter(Boolean) as Record<string, unknown>[];
    if (ordered.length === 0) {
      return { ok: false, message: "No matching active template tasks found." } as VendorActionResult;
    }

    let warnedNoEventDate = false;
    const createdIds: string[] = [];

    for (const t of ordered) {
      const daysOffset = (t.days_offset as number | null) ?? null;
      let dueDate: string | null = null;
      if (daysOffset != null) {
        if (eventDate) {
          dueDate = offsetDate(eventDate, daysOffset);
        } else {
          warnedNoEventDate = true;
        }
      }
      const pack = t.vendor_task_templates as { id: string };
      const coupleVisibility =
        opts.coupleVisibility === "visible" || opts.coupleVisibility === "owned"
          ? opts.coupleVisibility
          : "private";
      const actionType = t.action_type === "share_timeline" ? "share_timeline" : null;
      const requireVendorConfirmation =
        Boolean(opts.requireVendorConfirmation)
        && coupleVisibility === "owned"
        && actionType == null;
      const completionAuthority = requireVendorConfirmation
        ? "vendor_confirm"
        : deriveCompletionAuthority({ coupleVisibility, actionType });
      const { data: inserted, error: insertError } = await supabase
        .from("vendor_tasks")
        .insert({
          vendor_id:          vendorId,
          event_id:           eventId,
          title:              (t.title as string).trim(),
          notes:              (t.notes as string | null) ?? null,
          due_date:           dueDate,
          days_offset:        daysOffset,
          template_id:        pack.id,
          template_item_id:   t.id as string,
          source:             "template",
          status:             "pending",
          couple_visibility:  coupleVisibility,
          action_type:        actionType,
          completion_authority: completionAuthority,
        })
        .select("id")
        .single();
      if (insertError) return { ok: false, message: insertError.message } as VendorActionResult;
      createdIds.push((inserted as { id: string }).id);
    }

    // Copy template item attachments onto applied tasks (same storage paths).
    const { data: attRows } = await supabase
      .from("vendor_task_template_item_attachments")
      .select("*")
      .in("item_id", ordered.map((t) => t.id as string))
      .order("sort_order", { ascending: true });

    if (attRows && attRows.length > 0) {
      const itemToTask = new Map(
        ordered.map((t, idx) => [t.id as string, createdIds[idx]]),
      );
      const taskAttRows = (attRows as Record<string, unknown>[]).flatMap((a) => {
        const taskId = itemToTask.get(a.item_id as string);
        if (!taskId) return [];
        return [{
          vendor_task_id: taskId,
          name:           a.name as string,
          storage_path:   a.storage_path as string,
          storage_url:    a.storage_url as string,
          mime_type:      (a.mime_type as string | null) ?? null,
          file_size:      a.file_size ?? null,
          sort_order:     (a.sort_order as number) ?? 0,
        }];
      });
      if (taskAttRows.length > 0) {
        const { error: attErr } = await supabase
          .from("vendor_task_attachments")
          .insert(taskAttRows);
        if (attErr) return { ok: false, message: attErr.message } as VendorActionResult;
      }
    }

    return {
      ok: true,
      createdCount: createdIds.length,
      warnedNoEventDate,
      assignmentId,
    } as VendorActionResult & {
      createdCount: number;
      warnedNoEventDate: boolean;
      assignmentId: string;
    };
  });

  return result as VendorActionResult & {
    createdCount?: number;
    warnedNoEventDate?: boolean;
    assignmentId?: string;
  };
}
