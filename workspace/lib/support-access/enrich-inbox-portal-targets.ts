/**
 * Stage 1F — fill missing vendorId / relatedVenueId on Partner Support inbox
 * rows so portal actions can render (fail closed when ambiguous).
 */
import type { SupportInboxItem } from "@shared/relationships";
import { createClient } from "@supabase/supabase-js";

import { resolveVenueForVendor } from "./resolve-partner-venue";

function admin() {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function enrichInboxPortalTargets(
  items: SupportInboxItem[],
): Promise<SupportInboxItem[]> {
  const sb = admin();
  const out: SupportInboxItem[] = [];

  for (const item of items) {
    if (item.surface !== "vendor") {
      out.push(item);
      continue;
    }

    let vendorId = item.vendorId?.trim() || null;
    let relatedVenueId = item.relatedVenueId?.trim() || null;

    if (!vendorId && sb) {
      if (item.actorEmail?.trim()) {
        const email = item.actorEmail.trim().toLowerCase();
        const { data } = await sb
          .from("vendors")
          .select("id")
          .ilike("email", email)
          .limit(2);
        if (data?.length === 1 && data[0]?.id) {
          vendorId = String(data[0].id);
        }
      }
      // Inbox rows often show "Business Name · email" without a stable vendorId.
      if (!vendorId && item.actorName?.trim()) {
        const name = item.actorName.trim();
        const { data } = await sb
          .from("vendors")
          .select("id")
          .ilike("business_name", name)
          .limit(2);
        if (data?.length === 1 && data[0]?.id) {
          vendorId = String(data[0].id);
        }
      }
    }

    if (vendorId && !relatedVenueId) {
      const resolved = await resolveVenueForVendor({ vendorId });
      if (resolved.ok) relatedVenueId = resolved.venueId;
    }

    out.push({
      ...item,
      vendorId,
      relatedVenueId,
    });
  }

  return out;
}
