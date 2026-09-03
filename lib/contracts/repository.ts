/**
 * Contracts data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  Contract,
  ContractActivity,
  ContractBrandingSnapshot,
  ContractTemplate,
  ContractWithDetails,
  NewContractInput,
  TemplateInput,
} from "@/lib/contracts/types";
import type { ContractSigner } from "@/lib/contracts/signers";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = {
  id: string; venue_id: string; name: string; description: string | null;
  content: string; is_default: boolean; is_archived: boolean;
  source_master_key: string | null;
  created_at: string; updated_at: string;
};
type ContractRow = {
  id: string; venue_id: string; client_id: string | null; event_id: string | null;
  template_id: string | null; title: string; content: string; status: Contract["status"];
  execution_origin?: Contract["executionOrigin"] | null;
  sign_token: string; signer_name: string | null; signed_at: string | null;
  sent_at: string | null; expires_at: string | null; created_at: string; updated_at: string;
  amends_contract_id: string | null;
  branding_snapshot: ContractBrandingSnapshot | null;
  clients?: { first_name: string; last_name: string; partner_first_name: string | null; partner_last_name: string | null; email: string | null } | null;
  events?: { event_date: string | null } | null;
  venue?: { name: string | null; primaryColor: string | null; secondaryColor: string | null; accentColor: string | null; neutralColor: string | null; logoUrl: string | null } | null;
  signer?: {
    id: string | null;
    signerType: string;
    signerName: string | null;
    signerEmail: string | null;
    signedAt: string | null;
    legacy: boolean;
  } | null;
};
type ActRow = {
  id: string; venue_id: string; contract_id: string; type: string; title: string;
  description: string | null; created_at: string;
  actor_id: string | null; actor_label: string | null;
};
type SignerRow = {
  id: string; contract_id: string; venue_id: string; signer_type: "venue" | "client";
  signer_role: string | null; signer_ref_id: string | null; client_contact_id: string | null;
  signer_name: string | null; signer_email: string | null; is_required: boolean;
  sign_order: number; sign_token: string; signed_at: string | null;
  signer_ip: string | null; signer_user_agent: string | null;
  consent_confirmed: boolean | null; consent_text: string | null; content_hash: string | null;
  created_at: string; updated_at: string;
};

function mapTemplate(r: TemplateRow): ContractTemplate {
  return {
    id: r.id, venueId: r.venue_id, name: r.name, description: r.description,
    content: r.content, isDefault: r.is_default, isArchived: r.is_archived,
    sourceMasterKey: r.source_master_key ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
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
    executionOrigin: r.execution_origin === "external" ? "external" : "htc",
    signToken: r.sign_token, signerName: r.signer_name, signedAt: r.signed_at,
    sentAt: r.sent_at, expiresAt: r.expires_at, createdAt: r.created_at, updatedAt: r.updated_at,
    amendsContractId: r.amends_contract_id ?? null,
    brandingSnapshot: r.branding_snapshot ?? null,
    clientName: cn, clientEmail: r.clients?.email ?? null, eventDate: r.events?.event_date ?? null,
    venue: r.venue,
  };
}

function mapSigner(r: SignerRow): ContractSigner {
  return {
    id: r.id,
    contractId: r.contract_id,
    venueId: r.venue_id,
    signerType: r.signer_type,
    signerRole: r.signer_role,
    signerRefId: r.signer_ref_id,
    clientContactId: r.client_contact_id,
    signerName: r.signer_name,
    signerEmail: r.signer_email,
    isRequired: r.is_required,
    signOrder: r.sign_order,
    signToken: r.sign_token,
    signedAt: r.signed_at,
    signerIp: r.signer_ip,
    signerUserAgent: r.signer_user_agent,
    consentConfirmed: r.consent_confirmed,
    consentText: r.consent_text,
    contentHash: r.content_hash,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapActivity(r: ActRow): ContractActivity {
  return {
    id: r.id, venueId: r.venue_id, contractId: r.contract_id, type: r.type,
    title: r.title, description: r.description,
    actorId: r.actor_id ?? null, actorLabel: r.actor_label ?? null,
    createdAt: r.created_at,
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

/**
 * Work Package D6 §57 — RLS's DELETE-role gate (Owner/Manager only,
 * contract_templates_delete_gate) blocks a disallowed delete by matching
 * zero rows, not by raising a Postgres error. Before this fix, that meant
 * a Staff/Coordinator delete attempt silently did nothing in the database
 * while the caller still reported `{ ok: true }` — a false-positive
 * success, worse than a blocked action with an honest error. `.select("id")`
 * on the delete surfaces which rows actually matched.
 */
export async function deleteTemplate(client: DbClient, venueId: string, id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await client.from("contract_templates").delete().eq("id", id).eq("venue_id", venueId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    return { ok: false, message: "Only an Owner or Manager can delete this template." };
  }
  return { ok: true };
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
  const [cRes, aRes, sRes] = await Promise.all([
    client.from("contracts")
      .select("*, clients(first_name, last_name, partner_first_name, partner_last_name, email), events(event_date)")
      .eq("id", id).eq("venue_id", venueId).maybeSingle<ContractRow>(),
    client.from("contract_activities").select("*").eq("contract_id", id).order("created_at", { ascending: false }),
    client.from("contract_signers").select("*").eq("contract_id", id).eq("venue_id", venueId).order("sign_order").order("created_at"),
  ]);
  if (cRes.error) throw cRes.error;
  if (aRes.error) throw aRes.error;
  if (sRes.error) throw sRes.error;
  if (!cRes.data) return null;
  return {
    ...mapContract(cRes.data as unknown as ContractRow),
    activities: (aRes.data as ActRow[]).map(mapActivity),
    signers: (sRes.data as SignerRow[]).map(mapSigner),
  };
}

/**
 * Read a contract by sign_token (for the public signing page). Goes through
 * a SECURITY DEFINER RPC rather than a direct table read — TR-L6: the table
 * previously had a permissive RLS policy allowing any unauthenticated
 * request to read a sent/signed contract by status alone, with no
 * sign_token check at the database layer. The RPC validates the token
 * server-side, the same pattern used by get_portal_context/sign_contract.
 * Also enforces expires_at and resolves per-signer tokens.
 */
export async function getContractByToken(client: DbClient, token: string): Promise<(Contract & {
  tokenSigner?: ContractRow["signer"];
}) | null> {
  const { data, error } = await client.rpc("get_contract_by_token", { p_token: token });
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as ContractRow;
  return { ...mapContract(row), tokenSigner: row.signer ?? null };
}

export async function getSignersForContract(client: DbClient, venueId: string, contractId: string): Promise<ContractSigner[]> {
  const { data, error } = await client.from("contract_signers")
    .select("*").eq("contract_id", contractId).eq("venue_id", venueId)
    .order("sign_order").order("created_at");
  if (error) throw error;
  return (data as SignerRow[]).map(mapSigner);
}

export type ClientSignerSeed = {
  clientContactId: string | null;
  signerRefId: string | null;
  signerName: string;
  signerEmail: string;
  signerRole: string | null;
};

export async function insertContractSigners(
  client: DbClient,
  venueId: string,
  contractId: string,
  clientSigners: ClientSignerSeed[],
): Promise<void> {
  // Venue signer placeholder (unsigned) — sign_order 0; clients parallel at 1
  const rows = [
    {
      contract_id: contractId,
      venue_id: venueId,
      signer_type: "venue",
      signer_role: null,
      signer_ref_id: null,
      client_contact_id: null,
      signer_name: null,
      signer_email: null,
      is_required: true,
      sign_order: 0,
    },
    ...clientSigners.map((s) => ({
      contract_id: contractId,
      venue_id: venueId,
      signer_type: "client" as const,
      signer_role: s.signerRole,
      signer_ref_id: s.signerRefId,
      client_contact_id: s.clientContactId,
      signer_name: s.signerName,
      signer_email: s.signerEmail,
      is_required: true,
      sign_order: 1,
    })),
  ];
  const { error } = await client.from("contract_signers").insert(rows);
  if (error) throw error;
}

export async function venueSignContract(
  client: DbClient,
  venueId: string,
  contractId: string,
  opts: {
    signerName: string;
    signerEmail: string | null;
    signerRole: string;
    signerRefId: string;
    consent: boolean;
    consentText: string;
    contentHash: string;
    ip: string | null;
    userAgent: string | null;
    actorId: string | null;
    actorLabel: string | null;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: contract, error: cErr } = await client.from("contracts")
    .select("id, status, content")
    .eq("id", contractId).eq("venue_id", venueId)
    .maybeSingle<{ id: string; status: Contract["status"]; content: string }>();
  if (cErr) throw cErr;
  if (!contract) return { ok: false, message: "Contract not found." };
  if (contract.status !== "draft") {
    return { ok: false, message: "Only a draft contract can be signed by the venue." };
  }
  if (!opts.consent) {
    return { ok: false, message: "Please confirm you agree this constitutes your legal signature." };
  }

  const { data: venueSigner, error: sErr } = await client.from("contract_signers")
    .select("id, signed_at")
    .eq("contract_id", contractId).eq("venue_id", venueId).eq("signer_type", "venue")
    .maybeSingle<{ id: string; signed_at: string | null }>();
  if (sErr) throw sErr;
  if (!venueSigner) return { ok: false, message: "Venue signer record not found." };
  if (venueSigner.signed_at) return { ok: false, message: "This contract has already been signed by the venue." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (client.from("contract_signers") as any)
    .update({
      signed_at: new Date().toISOString(),
      signer_name: opts.signerName.trim(),
      signer_email: opts.signerEmail,
      signer_role: opts.signerRole,
      signer_ref_id: opts.signerRefId,
      signer_ip: opts.ip,
      signer_user_agent: opts.userAgent,
      consent_confirmed: true,
      consent_text: opts.consentText,
      content_hash: opts.contentHash,
      updated_at: new Date().toISOString(),
    })
    .eq("id", venueSigner.id)
    .eq("venue_id", venueId)
    .eq("signer_type", "venue")
    .is("signed_at", null)
    .select("id");
  if (error) throw error;
  if (!updated || updated.length === 0) {
    return { ok: false, message: "Could not record the venue signature." };
  }

  await insertContractActivity(
    client, venueId, contractId, "venue_signed", "Signed by venue",
    `Signed by ${opts.signerName.trim()}`,
    opts.actorId, opts.actorLabel,
  );
  return { ok: true };
}

export async function clearVenueSignature(
  client: DbClient, venueId: string, contractId: string,
  actorId: string | null, actorLabel: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: contract } = await client.from("contracts")
    .select("status").eq("id", contractId).eq("venue_id", venueId)
    .maybeSingle<{ status: Contract["status"] }>();
  if (!contract) return { ok: false, message: "Contract not found." };
  if (contract.status !== "draft") {
    return { ok: false, message: "Only a draft contract's venue signature can be withdrawn." };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("contract_signers") as any)
    .update({
      signed_at: null, signer_ip: null, signer_user_agent: null,
      consent_confirmed: null, consent_text: null, content_hash: null,
      signer_ref_id: null, updated_at: new Date().toISOString(),
    })
    .eq("contract_id", contractId).eq("venue_id", venueId).eq("signer_type", "venue");
  if (error) throw error;
  await insertContractActivity(
    client, venueId, contractId, "venue_signature_withdrawn",
    "Venue signature withdrawn", "Withdrawn so the agreement can be edited",
    actorId, actorLabel,
  );
  return { ok: true };
}

export async function insertContract(client: DbClient, venueId: string, input: NewContractInput): Promise<string> {
  // "__default__" is the client-only placeholder id used by /contracts/new
  // when the venue has no saved templates yet (app/(app)/contracts/new/page.tsx)
  // — it's never a real contract_templates row, so it must never reach the
  // uuid FK column (was raising 22P02: invalid input syntax for type uuid).
  const templateId = input.templateId && input.templateId !== "__default__" ? input.templateId : null;
  const { data, error } = await client.from("contracts")
    .insert({ venue_id: venueId, client_id: input.clientId || null, event_id: input.eventId || null,
      template_id: templateId, title: input.title.trim(), content: input.content,
      amends_contract_id: input.amendsContractId ?? null })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

/**
 * TR-L1 + venue-first signing: editable only while draft AND venue has not
 * yet signed. Once the venue signer has signed_at set, content is immutable.
 */
export async function updateContractContent(
  client: DbClient, venueId: string, id: string, title: string, content: string, expectedUpdatedAt: string,
): Promise<{ ok: true } | { ok: false; message: string; reason?: "stale" | "not_editable" | "not_found" }> {
  const { data: existing, error: fetchError } = await client
    .from("contracts")
    .select("status")
    .eq("id", id).eq("venue_id", venueId)
    .maybeSingle<{ status: Contract["status"] }>();
  if (fetchError) throw fetchError;
  if (!existing) return { ok: false, message: "Contract not found.", reason: "not_found" };
  if (existing.status !== "draft") {
    return { ok: false, message: "This contract has already been sent and can no longer be edited.", reason: "not_editable" };
  }

  const { data: venueSigner } = await client.from("contract_signers")
    .select("signed_at")
    .eq("contract_id", id).eq("venue_id", venueId).eq("signer_type", "venue")
    .maybeSingle<{ signed_at: string | null }>();
  if (venueSigner?.signed_at) {
    return {
      ok: false,
      message: "This contract has been signed by the venue and can no longer be edited. Withdraw the venue signature first if changes are needed.",
      reason: "not_editable",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (client.from("contracts") as any).update({ title: title.trim(), content })
    .eq("id", id).eq("venue_id", venueId).eq("updated_at", expectedUpdatedAt)
    .select("id");
  if (error) throw error;

  if (!updated || updated.length === 0) {
    return {
      ok: false,
      reason: "stale",
      message: "This contract was updated while you were editing it. Please review the latest version before saving your changes.",
    };
  }

  await insertContractActivity(client, venueId, id, "edited", "Contract content edited");
  return { ok: true };
}

/**
 * Reopen sent → draft for negotiation. Clears venue + client signature
 * evidence so content becomes editable again under the venue-first model.
 */
export async function reopenForEditing(
  client: DbClient, venueId: string, id: string,
  actorId?: string | null, actorLabel?: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (client.from("contracts") as any)
    .update({ status: "draft", sent_at: null, is_couple_visible: false })
    .eq("id", id).eq("venue_id", venueId).eq("status", "sent")
    .select("id");
  if (error) throw error;
  if (!updated || updated.length === 0) {
    return { ok: false, message: "Only a sent, unsigned contract can be reopened for editing." };
  }

  // Clear all signature evidence; keep signer rows and regenerate unique tokens
  const { data: existingSigners } = await client.from("contract_signers")
    .select("id").eq("contract_id", id).eq("venue_id", venueId);
  for (const row of existingSigners ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("contract_signers") as any)
      .update({
        signed_at: null, signer_ip: null, signer_user_agent: null,
        consent_confirmed: null, consent_text: null, content_hash: null,
        sign_token: crypto.randomUUID(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", (row as { id: string }).id)
      .eq("venue_id", venueId);
  }

  await insertContractActivity(
    client, venueId, id, "reopened", "Reopened for editing",
    undefined, actorId ?? null, actorLabel ?? null,
  );
  return { ok: true };
}

export async function updateContractStatus(
  client: DbClient,
  venueId: string,
  id: string,
  status: Contract["status"],
  extra?: { sentAt?: boolean; brandingSnapshot?: ContractBrandingSnapshot },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: current } = await client.from("contracts")
    .select("status, branding_snapshot")
    .eq("id", id).eq("venue_id", venueId)
    .maybeSingle<{ status: Contract["status"]; branding_snapshot: ContractBrandingSnapshot | null }>();
  if (!current) return { ok: false, message: "Contract not found." };

  if (status === "sent" && current.status !== "draft") {
    return { ok: false, message: "Only a draft contract can be sent for signing." };
  }
  if (status === "sent") {
    const { data: venueSigner } = await client.from("contract_signers")
      .select("signed_at")
      .eq("contract_id", id).eq("venue_id", venueId).eq("signer_type", "venue")
      .maybeSingle<{ signed_at: string | null }>();
    // New-model contracts always have a venue signer row; require signed_at.
    // Legacy contracts created before this migration may have zero signer rows
    // — those are not created anymore; block release without venue signature.
    if (!venueSigner?.signed_at) {
      return { ok: false, message: "The venue must sign this contract before it can be released to the client." };
    }
  }
  if (status === "cancelled" && !["draft", "sent"].includes(current.status)) {
    return { ok: false, message: "A signed contract cannot be cancelled this way — it's a permanent record." };
  }

  const update: Record<string, unknown> = { status };
  if (extra?.sentAt) {
    update.sent_at = new Date().toISOString();
    update.is_couple_visible = true;
  }
  // Presentation-only snapshot at draft→sent. Never overwrite an existing
  // snapshot (re-send / later transitions must not re-capture branding).
  if (extra?.brandingSnapshot && current.status === "draft" && !current.branding_snapshot) {
    update.branding_snapshot = extra.brandingSnapshot;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("contracts") as any).update(update).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
  return { ok: true };
}

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

  const { data, error } = await client.from("contracts").delete().eq("id", id).eq("venue_id", venueId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    return { ok: false, message: "Only an Owner or Manager can delete a contract." };
  }
  return { ok: true };
}

/**
 * Work Package D6 §11 — internal-only. Also blocked once venue has signed
 * (force-resolve must not alter committed content).
 */
export async function forceResolveContractContent(client: DbClient, venueId: string, id: string, content: string): Promise<void> {
  const { data: venueSigner } = await client.from("contract_signers")
    .select("signed_at")
    .eq("contract_id", id).eq("venue_id", venueId).eq("signer_type", "venue")
    .maybeSingle<{ signed_at: string | null }>();
  if (venueSigner?.signed_at) {
    throw new Error("Cannot modify content after the venue has signed.");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("contracts") as any).update({ content }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function insertContractActivity(
  client: DbClient,
  venueId: string,
  contractId: string,
  type: string,
  title: string,
  description?: string,
  actorId?: string | null,
  actorLabel?: string | null,
): Promise<void> {
  const { error } = await client.from("contract_activities")
    .insert({
      venue_id: venueId,
      contract_id: contractId,
      type,
      title,
      description: description ?? null,
      actor_id: actorId ?? null,
      actor_label: actorLabel ?? null,
    });
  if (error) throw error;
}
