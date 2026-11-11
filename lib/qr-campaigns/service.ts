import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { interpretQrCampaignUpdate } from "@/lib/qr-campaigns/archive-ui-state";
import { getCurrentVenue } from "@/lib/venue/service";
import type { QrCampaign, QrCampaignActionResult, QrCampaignAnalytics, QrCampaignInput } from "@/lib/qr-campaigns/types";

type CampaignRow = {
  id: string; venue_id: string; name: string; code: string;
  destination_type: QrCampaign["destinationType"]; destination_url: string | null;
  public_form_id: string | null;
  status: QrCampaign["status"]; source_master_key: string | null; created_at: string;
};

function mapCampaign(r: CampaignRow): QrCampaign {
  return {
    id: r.id, venueId: r.venue_id, name: r.name, code: r.code,
    destinationType: r.destination_type, destinationUrl: r.destination_url,
    publicFormId: r.public_form_id ?? null,
    status: r.status, sourceMasterKey: r.source_master_key ?? null, createdAt: r.created_at,
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
  if (input.destinationType === "public_form" && !input.publicFormId?.trim()) {
    return { ok: false, message: "Select a public form for this destination." };
  }
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();

  if (input.destinationType === "public_form" && input.publicFormId) {
    const { data: form } = await supabase
      .from("public_forms")
      .select("id, status")
      .eq("id", input.publicFormId)
      .eq("venue_id", venue.id)
      .maybeSingle<{ id: string; status: string }>();
    if (!form) return { ok: false, message: "That public form was not found." };
    if (form.status !== "published") {
      return { ok: false, message: "Publish the public form before linking a QR campaign." };
    }
  }

  const { data, error } = await supabase.from("qr_campaigns").insert({
    venue_id: venue.id,
    name: input.name.trim(),
    destination_type: input.destinationType,
    destination_url:
      input.destinationType === "public_form" || input.destinationType === "inquiry_form" || input.destinationType === "tour_booking"
        ? null
        : input.destinationUrl?.trim() || null,
    public_form_id: input.destinationType === "public_form" ? input.publicFormId!.trim() : null,
  }).select("id").single();
  if (error) return { ok: false, message: "Could not create campaign." };
  return { ok: true, id: (data as { id: string }).id };
}

export async function archiveQrCampaign(id: string): Promise<QrCampaignActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qr_campaigns")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("venue_id", venue.id)
    .select("id");
  return interpretQrCampaignUpdate(error, data as { id: string }[] | null);
}

export async function reactivateQrCampaign(id: string): Promise<QrCampaignActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qr_campaigns")
    .update({ status: "active" })
    .eq("id", id)
    .eq("venue_id", venue.id)
    .select("id");
  return interpretQrCampaignUpdate(error, data as { id: string }[] | null);
}
