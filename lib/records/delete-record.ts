/**
 * Venue record deletion — distinct from Lost.
 *
 * Lost = a real opportunity we did not win (stays in conversion).
 * Delete = this record should not exist (removed from counts and conversion).
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type DeleteImpact = {
  removesLead: boolean;
  removesClient: boolean;
  removesBookingHistory: boolean;
  leadCountDelta: number;
  bookingHistoryRemoved: boolean;
  conversionAffected: boolean;
  clientWorkspaceKept: boolean;
  financialsKept: boolean;
};

export type DeletePreview =
  | { ok: true; displayName: string; impact: DeleteImpact; confirmation: string[] }
  | { ok: false; message: string };

export type DeleteResult = { ok: true } | { ok: false; message: string };

type Db = Awaited<ReturnType<typeof createClient>>;

async function withVenue<T>(
  fn: (supabase: Db, venueId: string) => Promise<T>,
): Promise<T | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  return fn(supabase, venue.id);
}

async function clientHasFinancialHistory(
  supabase: Db,
  venueId: string,
  clientId: string,
): Promise<boolean> {
  const [{ data: contracts }, { data: payments }] = await Promise.all([
    supabase
      .from("contracts")
      .select("id")
      .eq("venue_id", venueId)
      .eq("client_id", clientId)
      .eq("status", "signed")
      .limit(1),
    supabase
      .from("payment_line_items")
      .select("id, payment_schedules!inner(client_id)")
      .eq("venue_id", venueId)
      .eq("payment_schedules.client_id", clientId)
      .in("status", ["paid", "partially_refunded", "refunded"])
      .limit(1),
  ]);
  return (contracts?.length ?? 0) > 0 || (payments?.length ?? 0) > 0;
}

async function removeLifecycleEventsFor(
  supabase: Db,
  venueId: string,
  opts: { leadId?: string | null; clientId?: string | null },
): Promise<boolean> {
  let removed = false;
  if (opts.leadId) {
    const { error, count } = await supabase
      .from("lifecycle_booking_events")
      .delete({ count: "exact" })
      .eq("venue_id", venueId)
      .eq("lead_id", opts.leadId);
    if (error) throw error;
    if ((count ?? 0) > 0) removed = true;
  }
  if (opts.clientId) {
    const { error, count } = await supabase
      .from("lifecycle_booking_events")
      .delete({ count: "exact" })
      .eq("venue_id", venueId)
      .eq("client_id", opts.clientId);
    if (error) throw error;
    if ((count ?? 0) > 0) removed = true;
  }
  return removed;
}

function confirmationLines(name: string, impact: DeleteImpact): string[] {
  const lines = [
    `This permanently removes ${name} from your records.`,
  ];
  if (impact.removesLead) {
    lines.push("Lead count will decrease by 1.");
    lines.push("This record will no longer affect conversion rates.");
  }
  if (impact.removesBookingHistory) {
    lines.push("Any Booking history for this record will be removed from reporting.");
  }
  if (impact.clientWorkspaceKept) {
    lines.push("The client workspace and any contracts or payments stay in place.");
  }
  if (impact.removesClient) {
    lines.push("The client workspace will be removed.");
  }
  if (impact.financialsKept) {
    lines.push("Signed contracts and collected payments are kept and are not deleted.");
  }
  lines.push("This is not the same as Lost. Use Lost when a real inquiry did not book.");
  return lines;
}

export async function previewDeleteLead(leadId: string): Promise<DeletePreview> {
  const result = await withVenue(async (supabase, venueId) => {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, first_name, last_name")
      .eq("id", leadId)
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string; first_name: string; last_name: string }>();
    if (!lead) return { ok: false, message: "Lead not found." } as const;
    const displayName = `${lead.first_name} ${lead.last_name}`.trim() || "this lead";

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("lead_id", leadId)
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string }>();

    const { data: booking } = await supabase
      .from("lifecycle_booking_events")
      .select("id")
      .eq("venue_id", venueId)
      .eq("lead_id", leadId)
      .eq("event_kind", "first_booked")
      .maybeSingle<{ id: string }>();

    const hasFinancials = client
      ? await clientHasFinancialHistory(supabase, venueId, client.id)
      : false;

    const impact: DeleteImpact = {
      removesLead: true,
      removesClient: false,
      removesBookingHistory: !!booking,
      leadCountDelta: -1,
      bookingHistoryRemoved: !!booking,
      conversionAffected: true,
      clientWorkspaceKept: !!client,
      financialsKept: hasFinancials,
    };
    return {
      ok: true as const,
      displayName,
      impact,
      confirmation: confirmationLines(displayName, impact),
    };
  });
  return result as DeletePreview;
}

/**
 * Destructive lead delete. Caller must have already previewed.
 * Booking history is removed and cannot be resurrected from client stamps.
 * Client workspace / contracts / payments are not deleted.
 */
export async function applyLeadRecordDeletion(
  supabase: Db,
  venueId: string,
  leadId: string,
): Promise<DeleteResult> {
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("lead_id", leadId)
    .eq("venue_id", venueId)
    .maybeSingle<{ id: string }>();

  await removeLifecycleEventsFor(supabase, venueId, { leadId });

  if (client) {
    // clients.lead_id becomes NULL on lead delete. If lifecycle stamps stay,
    // a leadless-client backfill would recreate first_booked for this workspace.
    const { error: stampError } = await supabase
      .from("clients")
      .update({
        lifecycle_booked_at: null,
        lifecycle_booking_origin: null,
      })
      .eq("id", client.id)
      .eq("venue_id", venueId);
    if (stampError) return { ok: false, message: stampError.message };
  }

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", leadId)
    .eq("venue_id", venueId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteLeadRecord(leadId: string): Promise<DeleteResult> {
  const preview = await previewDeleteLead(leadId);
  if (!preview.ok) return preview;
  const result = await withVenue(async (supabase, venueId) => {
    return applyLeadRecordDeletion(supabase, venueId, leadId);
  });
  return result as DeleteResult;
}

export async function previewDeleteClient(clientId: string): Promise<DeletePreview> {
  const result = await withVenue(async (supabase, venueId) => {
    const { data: client } = await supabase
      .from("clients")
      .select("id, first_name, last_name, lead_id")
      .eq("id", clientId)
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string; first_name: string; last_name: string; lead_id: string | null }>();
    if (!client) return { ok: false, message: "Client not found." } as const;
    const displayName = `${client.first_name} ${client.last_name}`.trim() || "this client";

    const hasFinancials = await clientHasFinancialHistory(supabase, venueId, clientId);
    if (hasFinancials) {
      return {
        ok: false,
        message:
          "This client has a signed contract or collected payments, so it cannot be deleted. Lost is not the right action for a duplicate — keep the real record and delete the extra inquiry instead.",
      } as const;
    }

    const { data: booking } = await supabase
      .from("lifecycle_booking_events")
      .select("id")
      .eq("venue_id", venueId)
      .or(`client_id.eq.${clientId}${client.lead_id ? `,lead_id.eq.${client.lead_id}` : ""}`)
      .eq("event_kind", "first_booked")
      .limit(1);

    const impact: DeleteImpact = {
      removesLead: !!client.lead_id,
      removesClient: true,
      removesBookingHistory: (booking?.length ?? 0) > 0,
      leadCountDelta: client.lead_id ? -1 : 0,
      bookingHistoryRemoved: (booking?.length ?? 0) > 0,
      conversionAffected: !!client.lead_id,
      clientWorkspaceKept: false,
      financialsKept: false,
    };
    return {
      ok: true as const,
      displayName,
      impact,
      confirmation: confirmationLines(displayName, impact),
    };
  });
  return result as DeletePreview;
}

export async function deleteClientRecord(clientId: string): Promise<DeleteResult> {
  const preview = await previewDeleteClient(clientId);
  if (!preview.ok) return preview;
  const result = await withVenue(async (supabase, venueId) => {
    const { data: client } = await supabase
      .from("clients")
      .select("id, lead_id")
      .eq("id", clientId)
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string; lead_id: string | null }>();
    if (!client) return { ok: false as const, message: "Client not found." };

    await removeLifecycleEventsFor(supabase, venueId, {
      leadId: client.lead_id,
      clientId,
    });

    const { data: events } = await supabase
      .from("events")
      .select("id")
      .eq("venue_id", venueId)
      .eq("client_id", clientId);
    for (const event of (events ?? []) as { id: string }[]) {
      const { error: eventError } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id)
        .eq("venue_id", venueId);
      if (eventError) {
        return {
          ok: false as const,
          message:
            "This record has related planning history that could not be removed automatically. Do not mark it Lost — keep the real record and delete only an extra inquiry.",
        };
      }
    }

    if (client.lead_id) {
      const { error: leadError } = await supabase
        .from("leads")
        .delete()
        .eq("id", client.lead_id)
        .eq("venue_id", venueId);
      if (leadError) {
        return { ok: false as const, message: leadError.message };
      }
    }

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId)
      .eq("venue_id", venueId);
    if (error) {
      return {
        ok: false as const,
        message:
          error.message.includes("foreign key") || error.code === "23503"
            ? "This record has related history that could not be removed automatically. Do not mark it Lost — delete only an extra inquiry, or keep this record."
            : error.message,
      };
    }
    return { ok: true as const };
  });
  return result as DeleteResult;
}
