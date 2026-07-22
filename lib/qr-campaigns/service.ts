import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import type { QrCampaign, QrCampaignActionResult, QrCampaignAnalytics, QrCampaignInput } from "@/lib/qr-campaigns/types";

type CampaignRow = {
  id: string; venue_id: string; name: string; code: string;
  destination_type: QrCampaign["destinationType"]; destination_url: string | null;
  status: QrCampaign["status"]; created_at: string;
};

function mapCampaign(r: CampaignRow): QrCampaign {
  return {
    id: r.id, venueId: r.venue_id, name: r.name, code: r.code,
    destinationType: r.destination_type, destinationUrl: r.destination_url,
    status: r.status, createdAt: r.created_at,
  };
}

export async function getQrCampaigns(includeArchived = false): Promise<QrCampaign[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  let query = supabase.from("qr_campaigns").select("*").eq("venue_id", venue.id).order("created_at", { ascending: false });
  if (!includeArchived) query = query.eq("status", "active");
  const { data } = await query;
  return ((data ?? []) as CampaignRow[]).map(mapCampaign);
}

export async function getQrCampaignAnalytics(): Promise<QrCampaignAnalytics[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_qr_campaign_analytics", { p_venue_id: venue.id });
  return (data ?? []) as QrCampaignAnalytics[];
}

export async function createQrCampaign(input: QrCampaignInput): Promise<QrCampaignActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!input.name.trim()) return { ok: false, message: "Name is required." };
  if ((input.destinationType === "wedding_website" || input.destinationType === "external_url") && !input.destinationUrl?.trim()) {
    return { ok: false, message: "A destination URL is required for this destination type." };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("qr_campaigns").insert({
    venue_id: venue.id, name: input.name.trim(), destination_type: input.destinationType,
    destination_url: input.destinationUrl?.trim() || null,
  }).select("id").single();
  if (error) return { ok: false, message: "Could not create campaign." };
  return { ok: true, id: (data as { id: string }).id };
}

export async function archiveQrCampaign(id: string): Promise<QrCampaignActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  const { error } = await supabase.from("qr_campaigns").update({ status: "archived" }).eq("id", id).eq("venue_id", venue.id);
  return { ok: !error };
}

export async function reactivateQrCampaign(id: string): Promise<QrCampaignActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  const { error } = await supabase.from("qr_campaigns").update({ status: "active" }).eq("id", id).eq("venue_id", venue.id);
  return { ok: !error };
}
