import type { QrCampaign, QrCampaignActionResult } from "@/lib/qr-campaigns/types";

export type QrCampaignStatus = QrCampaign["status"];

export function applyQrCampaignStatus(
  campaigns: QrCampaign[],
  id: string,
  status: QrCampaignStatus,
): QrCampaign[] {
  return campaigns.map((c) => (c.id === id ? { ...c, status } : c));
}

export type ArchiveToggleFeedback =
  | { kind: "success"; message: "Campaign archived" | "Campaign reactivated"; campaigns: QrCampaign[] }
  | { kind: "error"; message: string; campaigns: QrCampaign[] };

/**
 * Pure outcome of Archive / Reactivate for the mounted campaign list.
 * On failure, campaigns are unchanged. On success, only the matching row's status moves.
 */
export function resolveArchiveToggle(
  campaigns: QrCampaign[],
  campaignId: string,
  nextStatus: QrCampaignStatus,
  result: QrCampaignActionResult,
): ArchiveToggleFeedback {
  if (!result.ok) {
    return {
      kind: "error",
      message: result.message ?? "Could not update campaign.",
      campaigns,
    };
  }
  return {
    kind: "success",
    message: nextStatus === "archived" ? "Campaign archived" : "Campaign reactivated",
    campaigns: applyQrCampaignStatus(campaigns, campaignId, nextStatus),
  };
}

/** Interprets a Supabase update().select("id") result for archive/reactivate. */
export function interpretQrCampaignUpdate(
  error: { message?: string } | null,
  data: { id: string }[] | null,
): QrCampaignActionResult {
  if (error) return { ok: false, message: "Could not update campaign." };
  if (!data || data.length === 0) {
    return { ok: false, message: "This campaign couldn't be updated." };
  }
  return { ok: true };
}
