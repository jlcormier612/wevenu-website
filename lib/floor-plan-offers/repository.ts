/**
 * Event Floor Plan Offers data access. Server-only. Phase 2.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  EventFloorPlanOffer,
  EventFloorPlanOfferWithTemplate,
  UpsertEventFloorPlanOfferInput,
} from "@/lib/floor-plan-offers/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type OfferRow = {
  id: string;
  venue_id: string;
  event_id: string;
  floor_plan_template_id: string;
  sort_order: number;
  is_offered: boolean;
  couple_label: string | null;
  couple_blurb: string | null;
  created_at: string;
  updated_at: string;
};

const mapOffer = (r: OfferRow): EventFloorPlanOffer => ({
  id: r.id,
  venueId: r.venue_id,
  eventId: r.event_id,
  floorPlanTemplateId: r.floor_plan_template_id,
  sortOrder: r.sort_order,
  isOffered: r.is_offered,
  coupleLabel: r.couple_label,
  coupleBlurb: r.couple_blurb,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function listOffersForEvent(
  client: DbClient,
  venueId: string,
  eventId: string,
): Promise<EventFloorPlanOfferWithTemplate[]> {
  const [{ data: offerRows, error: offerError }, { data: templateRows, error: templateError }, { data: objRows, error: objError }] =
    await Promise.all([
      client.from("event_floor_plan_offers").select("*")
        .eq("venue_id", venueId).eq("event_id", eventId)
        .order("sort_order").order("created_at"),
      client.from("floor_plan_templates").select("id, name, is_archived, space_id")
        .eq("venue_id", venueId),
      client.from("floor_plan_template_objects").select("template_id")
        .eq("venue_id", venueId),
    ]);
  if (offerError) throw offerError;
  if (templateError) throw templateError;
  if (objError) throw objError;

  const templates = new Map(
    (templateRows as { id: string; name: string; is_archived: boolean; space_id: string | null }[])
      .map((t) => [t.id, t]),
  );
  const counts = new Map<string, number>();
  for (const row of (objRows as { template_id: string }[]) ?? []) {
    counts.set(row.template_id, (counts.get(row.template_id) ?? 0) + 1);
  }

  return ((offerRows as OfferRow[]) ?? []).map((r) => {
    const t = templates.get(r.floor_plan_template_id);
    return {
      ...mapOffer(r),
      templateName: t?.name ?? "Unknown template",
      templateArchived: Boolean(t?.is_archived),
      templateSpaceId: t?.space_id ?? null,
      objectCount: counts.get(r.floor_plan_template_id) ?? 0,
    };
  });
}

export async function upsertOffer(
  client: DbClient,
  venueId: string,
  eventId: string,
  input: UpsertEventFloorPlanOfferInput,
): Promise<string> {
  const payload = {
    venue_id: venueId,
    event_id: eventId,
    floor_plan_template_id: input.templateId,
    sort_order: input.sortOrder ?? 0,
    is_offered: input.isOffered ?? true,
    couple_label: input.coupleLabel?.trim() || null,
    couple_blurb: input.coupleBlurb?.trim() || null,
  };
  const { data, error } = await client.from("event_floor_plan_offers")
    .upsert(payload, { onConflict: "event_id,floor_plan_template_id" })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateOffer(
  client: DbClient,
  venueId: string,
  offerId: string,
  patch: {
    sortOrder?: number;
    isOffered?: boolean;
    coupleLabel?: string | null;
    coupleBlurb?: string | null;
  },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.isOffered !== undefined) update.is_offered = patch.isOffered;
  if (patch.coupleLabel !== undefined) update.couple_label = patch.coupleLabel?.trim() || null;
  if (patch.coupleBlurb !== undefined) update.couple_blurb = patch.coupleBlurb?.trim() || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_floor_plan_offers") as any)
    .update(update).eq("id", offerId).eq("venue_id", venueId);
  if (error) throw error;
}

/** Soft-withdraw: is_offered=false. Does not clear couple selection or delete clones. */
export async function withdrawOffer(
  client: DbClient,
  venueId: string,
  offerId: string,
): Promise<void> {
  await updateOffer(client, venueId, offerId, { isOffered: false });
}

export async function deleteOffer(
  client: DbClient,
  venueId: string,
  offerId: string,
): Promise<void> {
  const { error } = await client.from("event_floor_plan_offers")
    .delete().eq("id", offerId).eq("venue_id", venueId);
  if (error) throw error;
}
