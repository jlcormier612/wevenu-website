/**
 * Contracts data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  Contract,
  ContractActivity,
  ContractTemplate,
  ContractWithDetails,
  NewContractInput,
  TemplateInput,
} from "@/lib/contracts/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = {
  id: string; venue_id: string; name: string; description: string | null;
  content: string; is_default: boolean; is_archived: boolean; created_at: string; updated_at: string;
};
type ContractRow = {
  id: string; venue_id: string; client_id: string | null; event_id: string | null;
  template_id: string | null; title: string; content: string; status: Contract["status"];
  sign_token: string; signer_name: string | null; signed_at: string | null;
  sent_at: string | null; expires_at: string | null; created_at: string; updated_at: string;
  clients?: { first_name: string; last_name: string; partner_first_name: string | null; partner_last_name: string | null } | null;
  events?: { event_date: string | null } | null;
};
type ActRow = { id: string; venue_id: string; contract_id: string; type: string; title: string; description: string | null; created_at: string; };

function mapTemplate(r: TemplateRow): ContractTemplate {
  return { id: r.id, venueId: r.venue_id, name: r.name, description: r.description,
    content: r.content, isDefault: r.is_default, isArchived: r.is_archived,
    createdAt: r.created_at, updatedAt: r.updated_at };
}

function mapContract(r: ContractRow): Contract {
  const cn = r.clients
    ? [r.clients.first_name, r.clients.last_name].join(" ") +
      (r.clients.partner_first_name
        ? ` & ${[r.clients.partner_first_name, r.clients.partner_last_name].filter(Boolean).join(" ")}`
        : "")
    : null;
  return {
    id: r.id, venueId: r.venue_id, clientId: r.client_id, eventId: r.event_id,
    templateId: r.template_id, title: r.title, content: r.content, status: r.status,
    signToken: r.sign_token, signerName: r.signer_name, signedAt: r.signed_at,
    sentAt: r.sent_at, expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at,
    clientName: cn, eventDate: r.events?.event_date ?? null,
  };
}

// ---- templates --------------------------------------------------------------

export async function getTemplates(client: DbClient, venueId: string, includeArchived = false): Promise<ContractTemplate[]> {
  let q = client.from("contract_templates").select("*").eq("venue_id", venueId);
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q.order("is_default", { ascending: false }).order("name");
  if (error) throw error;
  return (data as TemplateRow[]).map(mapTemplate);
}

export async function getTemplate(client: DbClient, venueId: string, id: string): Promise<ContractTemplate | null> {
  const { data, error } = await client.from("contract_templates").select("*")
    .eq("id", id).eq("venue_id", venueId).maybeSingle<TemplateRow>();
  if (error) throw error;
  return data ? mapTemplate(data) : null;
}

export async function insertTemplate(client: DbClient, venueId: string, input: TemplateInput): Promise<string> {
  // Clear other defaults if this one is default
  if (input.isDefault) {
    await client.from("contract_templates").update({ is_default: false }).eq("venue_id", venueId);
  }
  const { data, error } = await client.from("contract_templates")
    .insert({ venue_id: venueId, name: input.name.trim(), description: input.description.trim() || null,
      content: input.content, is_default: input.isDefault })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateTemplate(client: DbClient, venueId: string, id: string, input: TemplateInput): Promise<void> {
  if (input.isDefault) {
    await client.from("contract_templates").update({ is_default: false }).eq("venue_id", venueId).neq("id", id);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("contract_templates") as any)
    .update({ name: input.name.trim(), description: input.description.trim() || null,
      content: input.content, is_default: input.isDefault })
    .eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteTemplate(client: DbClient, venueId: string, id: string): Promise<void> {
  const { error } = await client.from("contract_templates").delete().eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setTemplateArchived(client: DbClient, venueId: string, id: string, isArchived: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("contract_templates") as any)
    .update({ is_archived: isArchived }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

// Template Platform — Release Readiness: Duplicate, matching the identical
// pattern Playbooks/Timeline Templates/Floor Plan Templates already use — a
// fresh, independent, always-unarchived, never-default copy.
export async function duplicateTemplate(client: DbClient, venueId: string, sourceId: string, newName: string): Promise<string> {
  const source = await getTemplate(client, venueId, sourceId);
  if (!source) throw new Error("Template not found.");
  return insertTemplate(client, venueId, {
    name: newName, description: source.description ?? "", content: source.content, isDefault: false,
  });
}

// ---- contracts --------------------------------------------------------------

export async function getContracts(client: DbClient, venueId: string): Promise<Contract[]> {
  const { data, error } = await client.from("contracts")
    .select("*, clients(first_name, last_name, partner_first_name, partner_last_name), events(event_date)")
    .eq("venue_id", venueId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as ContractRow[]).map(mapContract);
}

export async function getContract(client: DbClient, venueId: string, id: string): Promise<ContractWithDetails | null> {
  const [cRes, aRes] = await Promise.all([
    client.from("contracts")
      .select("*, clients(first_name, last_name, partner_first_name, partner_last_name), events(event_date)")
      .eq("id", id).eq("venue_id", venueId).maybeSingle<ContractRow>(),
    client.from("contract_activities").select("*").eq("contract_id", id).order("created_at", { ascending: false }),
  ]);
  if (cRes.error) throw cRes.error;
  if (aRes.error) throw aRes.error;
  if (!cRes.data) return null;
  return { ...mapContract(cRes.data as unknown as ContractRow), activities: (aRes.data as ActRow[]).map(r => ({ id: r.id, venueId: r.venue_id, contractId: r.contract_id, type: r.type, title: r.title, description: r.description, createdAt: r.created_at })) };
}

/**
 * Read a contract by sign_token (for the public signing page). Goes through
 * a SECURITY DEFINER RPC rather than a direct table read — TR-L6: the table
 * previously had a permissive RLS policy allowing any unauthenticated
 * request to read a sent/signed contract by status alone, with no
 * sign_token check at the database layer. The RPC validates the token
 * server-side, the same pattern used by get_portal_context/sign_contract.
 */
export async function getContractByToken(client: DbClient, token: string): Promise<Contract | null> {
  const { data, error } = await client.rpc("get_contract_by_token", { p_token: token });
  if (error) throw error;
  return data ? mapContract(data as unknown as ContractRow) : null;
}

export async function insertContract(client: DbClient, venueId: string, input: NewContractInput): Promise<string> {
  const { data, error } = await client.from("contracts")
    .insert({ venue_id: venueId, client_id: input.clientId || null, event_id: input.eventId || null,
      template_id: input.templateId || null, title: input.title.trim(), content: input.content })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

/**
 * TR-L1 (Trust Risk Register): this used to have no status check at all —
 * a signed contract's legally-binding text could be edited exactly like a
 * draft, with no trace in the activity log. Now only draft contracts are
 * editable, and every edit is logged.
 */
export async function updateContractContent(client: DbClient, venueId: string, id: string, title: string, content: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: existing, error: fetchError } = await client
    .from("contracts")
    .select("status")
    .eq("id", id).eq("venue_id", venueId)
    .maybeSingle<{ status: Contract["status"] }>();
  if (fetchError) throw fetchError;
  if (!existing) return { ok: false, message: "Contract not found." };
  if (existing.status !== "draft") {
    return { ok: false, message: "This contract has already been sent and can no longer be edited." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("contracts") as any).update({ title: title.trim(), content })
    .eq("id", id).eq("venue_id", venueId);
  if (error) throw error;

  await insertContractActivity(client, venueId, id, "edited", "Contract content edited");
  return { ok: true };
}

/**
 * TR-L5 (Trust Risk Register): sendContract/cancelContract previously had no
 * status guard at all — calling send on an already-signed contract silently
 * flipped it back to 'sent' and re-armed the still-valid sign_token for a
 * second signature, overwriting the original signer name/timestamp/IP/
 * consent. Now enforces the same transitions the UI already assumes:
 * send only from 'draft', cancel only from 'draft' or 'sent'. Never signed,
 * never already-cancelled — a signed contract's status cannot be changed by
 * this function at all, full stop.
 */
export async function updateContractStatus(
  client: DbClient,
  venueId: string,
  id: string,
  status: Contract["status"],
  extra?: { sentAt?: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: current } = await client.from("contracts")
    .select("status").eq("id", id).eq("venue_id", venueId).maybeSingle<{ status: Contract["status"] }>();
  if (!current) return { ok: false, message: "Contract not found." };

  if (status === "sent" && current.status !== "draft") {
    return { ok: false, message: "Only a draft contract can be sent for signing." };
  }
  if (status === "cancelled" && !["draft", "sent"].includes(current.status)) {
    return { ok: false, message: "A signed contract cannot be cancelled this way — it's a permanent record." };
  }

  const update: Record<string, unknown> = { status };
  if (extra?.sentAt) update.sent_at = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("contracts") as any).update(update).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
  return { ok: true };
}

/**
 * TR-L2 (Trust Risk Register): this used to hard-delete any contract
 * regardless of status — a signed contract (the actual legal record) could
 * be permanently destroyed the same way a draft could. Now only draft or
 * cancelled contracts can be deleted; sent/signed contracts must be
 * cancelled first, preserving the record.
 */
export async function deleteContract(client: DbClient, venueId: string, id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: existing, error: fetchError } = await client
    .from("contracts")
    .select("status")
    .eq("id", id).eq("venue_id", venueId)
    .maybeSingle<{ status: Contract["status"] }>();
  if (fetchError) throw fetchError;
  if (!existing) return { ok: false, message: "Contract not found." };
  if (existing.status !== "draft" && existing.status !== "cancelled") {
    return { ok: false, message: "Only draft or cancelled contracts can be deleted. Cancel this contract first." };
  }

  const { error } = await client.from("contracts").delete().eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
  return { ok: true };
}

export async function insertContractActivity(client: DbClient, venueId: string, contractId: string, type: string, title: string, description?: string): Promise<void> {
  const { error } = await client.from("contract_activities")
    .insert({ venue_id: venueId, contract_id: contractId, type, title, description: description ?? null });
  if (error) throw error;
}
