/**
 * Public questionnaire page — /questionnaire/{access_key}
 *
 * No auth required. Couple completes Client Planning, Final Details, or
 * Post-Event Feedback. Responses update event_questionnaires via SECURITY DEFINER.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CoupleFamilyQuestionnaireForm } from "@/components/form/couple-family-questionnaire-form";
import { createClient } from "@/integrations/supabase/server";
import { kindLabel, type QuestionnaireKind } from "@/lib/questionnaire-family/definitions";

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_questionnaire_for_couple", { p_key: key });
  const row = data?.[0] as { kind?: string; event_name?: string; venue_name?: string } | undefined;
  const title = row?.kind ? kindLabel(row.kind as QuestionnaireKind) : "Your form";
  return row
    ? { title: { absolute: `${title} — ${row.event_name} · ${row.venue_name}` } }
    : { title: { absolute: title } };
}

export default async function CoupleQuestionnairePage({ params }: Props) {
  const { key } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_questionnaire_for_couple", { p_key: key });
  const row = data?.[0] as Record<string, unknown> | undefined;
  if (!row) notFound();

  void supabase.rpc("mark_questionnaire_opened", { p_key: key });

  // Enrich with vendors on file (review-and-confirm) — venue-scoped via questionnaire row.
  let knownVendors: { name: string; role?: string | null }[] = [];
  let clientPrimaryName: string | null = null;
  try {
    const { data: qMeta } = await supabase.from("event_questionnaires")
      .select("event_id, venue_id").eq("access_key", key).maybeSingle<{ event_id: string; venue_id: string }>();
    if (qMeta) {
      const { data: event } = await supabase.from("events")
        .select("client_id").eq("id", qMeta.event_id).maybeSingle<{ client_id: string | null }>();
      if (event?.client_id) {
        const { data: client } = await supabase.from("clients")
          .select("first_name, last_name, partner_first_name, partner_last_name")
          .eq("id", event.client_id).maybeSingle<{
            first_name: string; last_name: string;
            partner_first_name: string | null; partner_last_name: string | null;
          }>();
        if (client) {
          const primary = `${client.first_name} ${client.last_name}`.trim();
          const partner = client.partner_first_name
            ? `${client.partner_first_name} ${client.partner_last_name ?? ""}`.trim()
            : null;
          clientPrimaryName = partner ? `${primary} & ${partner}` : primary;
        }
      }
      const { data: assignments } = await supabase.from("event_vendor_assignments")
        .select("vendor_id, role, vendors(name)")
        .eq("event_id", qMeta.event_id)
        .eq("venue_id", qMeta.venue_id);
      knownVendors = ((assignments ?? []) as { role?: string | null; vendors?: { name?: string } | null }[])
        .map((a) => ({ name: a.vendors?.name ?? "Vendor", role: a.role ?? null }))
        .filter((v) => v.name);
    }
  } catch {
    /* enrichment is best-effort for public page */
  }

  return (
    <CoupleFamilyQuestionnaireForm
      accessKey={key}
      data={{
        questionnaire_id: row.questionnaire_id as string,
        kind: (row.kind as QuestionnaireKind) || "final_details",
        event_name: row.event_name as string,
        event_date: (row.event_date as string) ?? null,
        event_guest_count: (row.event_guest_count as number | null) ?? null,
        venue_name: row.venue_name as string,
        venue_logo_url: (row.venue_logo_url as string | null) ?? null,
        venue_primary_color: (row.venue_primary_color as string) || "#5D6F5D",
        public_review_url: (row.public_review_url as string | null) ?? null,
        status: row.status as string,
        final_guest_count: (row.final_guest_count as number | null) ?? null,
        meal_notes: (row.meal_notes as string | null) ?? null,
        processional_song: (row.processional_song as string | null) ?? null,
        recessional_song: (row.recessional_song as string | null) ?? null,
        first_dance_song: (row.first_dance_song as string | null) ?? null,
        parent_dances: (row.parent_dances as string | null) ?? null,
        emergency_contact_name: (row.emergency_contact_name as string | null) ?? null,
        emergency_contact_phone: (row.emergency_contact_phone as string | null) ?? null,
        special_requests: (row.special_requests as string | null) ?? null,
        ceremony_start_time: (row.ceremony_start_time as string | null) ?? null,
        reception_start_time: (row.reception_start_time as string | null) ?? null,
        ceremony_location: (row.ceremony_location as string | null) ?? null,
        reception_location: (row.reception_location as string | null) ?? null,
        vendor_notes: (row.vendor_notes as string | null) ?? null,
        included_fields: (row.included_fields as string[]) ?? [],
        required_fields: (row.required_fields as string[]) ?? [],
        additional: (row.additional as { family?: Record<string, string> }) ?? null,
        updated_at: row.updated_at as string | undefined,
        known_vendors: knownVendors,
        client_primary_name: clientPrimaryName,
      }}
    />
  );
}
