/**
 * Relationship Context Panel data — orientation first, then supporting work context.
 * Booking Journey remains the authority for booking stage.
 * Tasks stay out of Inbox.
 */
import { isSupabaseConfigured } from "@/lib/env";
import { getRequests } from "@/lib/requests/service";
import { getActivityTimelineForLeadOrClient } from "@/lib/activity-timeline/service";
import type { Request } from "@/lib/requests/types";
import type { ActivityTimelineEvent } from "@/lib/activity-timeline/types";
import {
  loadBookingJourneyForClient,
  loadBookingJourneyForLead,
} from "@/lib/booking-journey/load";
import type { BookingJourneyModel } from "@/lib/booking-journey/model";
import { createClient } from "@/integrations/supabase/server";

export type RelationshipOrientation = {
  displayName: string | null;
  relationshipType: "Lead" | "Booking";
  preferredDate: string | null;
  leadEventType: string | null;
  eventName: string | null;
  eventDate: string | null;
  eventType: string | null;
  eventId: string | null;
  /** Exactly one event — never invented from many. */
  eventUnambiguous: boolean;
  packageSummary: string | null;
  /** One actionable financial fact, or null when nothing meaningful. */
  financialFact: string | null;
  financialHref: string | null;
  bookingStageLabel: string | null;
  bookingStageKey: string | null;
  journey: BookingJourneyModel | null;
};

export type RelationshipContext = {
  orientation: RelationshipOrientation | null;
  requests: Request[];
  recentActivity: ActivityTimelineEvent[];
};

const EMPTY: RelationshipContext = { orientation: null, requests: [], recentActivity: [] };
const RECENT_ACTIVITY_LIMIT = 8;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function financialFactFromJourney(journey: BookingJourneyModel, clientId: string | null): {
  fact: string | null;
  href: string | null;
} {
  const href = clientId ? `/clients/${clientId}#payments` : null;
  if (!journey.selection) return { fact: null, href: null };
  const deposit = journey.depositSummary;
  const remaining = journey.remainingSummary;
  if (journey.currentKey === "deposit" && deposit && remaining) {
    return { fact: `${deposit} deposit due · ${remaining} remaining`, href };
  }
  if (journey.isCommerciallyBooked && remaining && remaining !== "$0") {
    return { fact: `${remaining} remaining`, href };
  }
  if (journey.currentKey === "deposit" && deposit) {
    return { fact: `${deposit} deposit due`, href };
  }
  return { fact: null, href: null };
}

export async function getRelationshipContext(
  leadId: string | null,
  clientId: string | null,
): Promise<RelationshipContext> {
  if (!isSupabaseConfigured || (!leadId && !clientId)) return EMPTY;

  const [requests, timeline, journey] = await Promise.all([
    clientId ? getRequests({ clientId }) : Promise.resolve([]),
    getActivityTimelineForLeadOrClient(leadId, clientId),
    clientId
      ? loadBookingJourneyForClient({ clientId, leadId })
      : leadId
        ? loadBookingJourneyForLead({ leadId })
        : Promise.resolve(null),
  ]);

  const supabase = await createClient();
  let displayName: string | null = null;
  let preferredDate: string | null = null;
  let leadEventType: string | null = null;
  let eventName: string | null = null;
  let eventDate: string | null = null;
  let eventType: string | null = null;
  let eventId: string | null = null;
  let eventUnambiguous = false;

  if (clientId) {
    const { data: client } = await supabase.from("clients")
      .select("first_name, last_name, partner_first_name")
      .eq("id", clientId)
      .maybeSingle<{ first_name: string; last_name: string | null; partner_first_name: string | null }>();
    if (client) {
      displayName = `${client.first_name}${client.last_name ? ` ${client.last_name}` : ""}${
        client.partner_first_name ? ` & ${client.partner_first_name}` : ""
      }`;
    }
    const { data: events } = await supabase.from("events")
      .select("id, name, event_date, event_type")
      .eq("client_id", clientId);
    const list = (events ?? []) as { id: string; name: string; event_date: string | null; event_type: string | null }[];
    if (list.length === 1) {
      eventUnambiguous = true;
      eventId = list[0]!.id;
      eventName = list[0]!.name;
      eventDate = list[0]!.event_date;
      eventType = list[0]!.event_type;
    }
  }

  if (leadId) {
    const { data: lead } = await supabase.from("leads")
      .select("first_name, last_name, partner_first_name, event_date, event_type")
      .eq("id", leadId)
      .maybeSingle<{
        first_name: string; last_name: string | null; partner_first_name: string | null;
        event_date: string | null; event_type: string | null;
      }>();
    if (lead) {
      if (!displayName) {
        displayName = `${lead.first_name}${lead.last_name ? ` ${lead.last_name}` : ""}${
          lead.partner_first_name ? ` & ${lead.partner_first_name}` : ""
        }`;
      }
      preferredDate = lead.event_date;
      leadEventType = lead.event_type;
    }
  }

  const money = journey ? financialFactFromJourney(journey, clientId) : { fact: null, href: null };
  const stage = journey?.stages.find((s) => s.key === journey.currentKey);

  return {
    orientation: {
      displayName,
      relationshipType: clientId ? "Booking" : "Lead",
      preferredDate: formatDate(preferredDate),
      leadEventType,
      eventName,
      eventDate: formatDate(eventDate),
      eventType,
      eventId,
      eventUnambiguous,
      packageSummary: journey?.packageSummary ?? null,
      financialFact: money.fact,
      financialHref: money.href,
      bookingStageLabel: stage?.label ?? null,
      bookingStageKey: journey?.currentKey ?? null,
      journey,
    },
    requests: requests.filter((r) => r.status !== "completed" && r.status !== "cancelled").slice(0, 5),
    recentActivity: timeline.slice(0, RECENT_ACTIVITY_LIMIT),
  };
}
