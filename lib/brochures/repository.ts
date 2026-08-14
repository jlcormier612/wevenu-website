/**
 * Brochures data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type { Brochure, BrochureActivity, BrochureInput, BrochureWithActivity } from "@/lib/brochures/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type BrochureRow = {
  id: string; venue_id: string; name: string; is_archived: boolean;
  welcome_text: string | null; include_packages: boolean; include_faqs: boolean;
  closing_text: string | null; share_token: string; source_master_key: string | null;
  created_at: string; updated_at: string;
};
type ActivityRow = {
  id: string; brochure_id: string; venue_id: string; type: string; title: string;
  description: string | null; created_at: string;
};

const mapBrochure = (r: BrochureRow): Brochure => ({
  id: r.id, venueId: r.venue_id, name: r.name, isArchived: r.is_archived,
  welcomeText: r.welcome_text, includePackages: r.include_packages, includeFaqs: r.include_faqs,
  closingText: r.closing_text, shareToken: r.share_token,
  sourceMasterKey: r.source_master_key ?? null,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapActivity = (r: ActivityRow): BrochureActivity => ({
  id: r.id, brochureId: r.brochure_id, venueId: r.venue_id, type: r.type,
  title: r.title, description: r.description, createdAt: r.created_at,
});

export async function getBrochures(client: DbClient, venueId: string, includeArchived = false): Promise<Brochure[]> {
  let q = client.from("brochures").select("*").eq("venue_id", venueId);
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q.order("name");
  if (error) throw error;
  return (data as BrochureRow[]).map(mapBrochure);
}

export async function getBrochure(client: DbClient, venueId: string, id: string): Promise<BrochureWithActivity | null> {
  const [bRes, aRes] = await Promise.all([
    client.from("brochures").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<BrochureRow>(),
    client.from("brochure_activities").select("*").eq("brochure_id", id).order("created_at", { ascending: false }),
  ]);
  if (bRes.error) throw bRes.error;
  if (aRes.error) throw aRes.error;
  if (!bRes.data) return null;
  return { ...mapBrochure(bRes.data), activities: (aRes.data as ActivityRow[]).map(mapActivity) };
}

export async function insertBrochure(client: DbClient, venueId: string, input: BrochureInput): Promise<string> {
  const { data, error } = await client.from("brochures")
    .insert({
      venue_id: venueId, name: input.name.trim(),
      welcome_text: input.welcomeText.trim() || null,
      include_packages: input.includePackages, include_faqs: input.includeFaqs,
      closing_text: input.closingText.trim() || null,
    })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateBrochure(client: DbClient, venueId: string, id: string, input: BrochureInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("brochures") as any)
    .update({
      name: input.name.trim(), welcome_text: input.welcomeText.trim() || null,
      include_packages: input.includePackages, include_faqs: input.includeFaqs,
      closing_text: input.closingText.trim() || null,
    })
    .eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setBrochureArchived(client: DbClient, venueId: string, id: string, isArchived: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("brochures") as any)
    .update({ is_archived: isArchived }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

/** Same D6 lesson: RESTRICTIVE delete gate blocks by matching zero rows, not by erroring — `.select("id")` makes a blocked delete an honest denial, not a false "deleted." */
export async function deleteBrochure(client: DbClient, venueId: string, id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await client.from("brochures").delete().eq("id", id).eq("venue_id", venueId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, message: "Only an Owner or Manager can delete this brochure." };
  return { ok: true };
}

export async function duplicateBrochure(client: DbClient, venueId: string, sourceId: string, newName: string): Promise<string> {
  const source = await getBrochure(client, venueId, sourceId);
  if (!source) throw new Error("Brochure not found.");
  return insertBrochure(client, venueId, {
    name: newName,
    welcomeText: source.welcomeText ?? "",
    includePackages: source.includePackages,
    includeFaqs: source.includeFaqs,
    closingText: source.closingText ?? "",
  });
}

export async function insertActivity(client: DbClient, venueId: string, brochureId: string, type: string, title: string, description?: string): Promise<void> {
  const { error } = await client.from("brochure_activities")
    .insert({ venue_id: venueId, brochure_id: brochureId, type, title, description: description ?? null });
  if (error) throw error;
}
