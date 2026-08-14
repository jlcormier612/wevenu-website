/**
 * Preview as client — uses the real CoupleFamilyQuestionnaireForm rendering.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CoupleFamilyQuestionnaireForm } from "@/components/form/couple-family-questionnaire-form";
import { getQuestionnaire } from "@/lib/events/questionnaire";
import { getEvent } from "@/lib/events/service";
import {
  getQuestionnaireMasterByKind,
  kindLabel,
  type QuestionnaireKind,
} from "@/lib/questionnaire-family/definitions";
import { getCurrentVenue } from "@/lib/venue/service";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const kind = (sp.kind as QuestionnaireKind) || "final_details";
  return { title: `Preview — ${kindLabel(kind)}` };
}

export default async function QuestionnairePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const { id: eventId } = await params;
  const sp = await searchParams;
  const kind = ((sp.kind as QuestionnaireKind) || "final_details") as QuestionnaireKind;
  const master = getQuestionnaireMasterByKind(kind);
  const [event, questionnaire, venue] = await Promise.all([
    getEvent(eventId),
    getQuestionnaire(eventId, kind),
    getCurrentVenue(),
  ]);
  if (!event || !venue) notFound();

  return (
    <CoupleFamilyQuestionnaireForm
      accessKey=""
      previewMode
      data={{
        questionnaire_id: questionnaire?.id ?? "preview",
        kind,
        event_name: event.name,
        event_date: event.eventDate,
        event_guest_count: event.guestCount ?? null,
        venue_name: venue.name,
        venue_logo_url: venue.logoUrl || null,
        venue_primary_color: venue.primaryColor,
        public_review_url: null,
        status: "sent",
        final_guest_count: questionnaire?.finalGuestCount ?? null,
        meal_notes: questionnaire?.mealNotes ?? null,
        processional_song: questionnaire?.processionalSong ?? null,
        recessional_song: questionnaire?.recessionalSong ?? null,
        first_dance_song: questionnaire?.firstDanceSong ?? null,
        parent_dances: questionnaire?.parentDances ?? null,
        emergency_contact_name: questionnaire?.emergencyContactName ?? null,
        emergency_contact_phone: questionnaire?.emergencyContactPhone ?? null,
        special_requests: questionnaire?.specialRequests ?? null,
        ceremony_start_time: questionnaire?.ceremonyStartTime ?? null,
        reception_start_time: questionnaire?.receptionStartTime ?? null,
        ceremony_location: questionnaire?.ceremonyLocation ?? null,
        reception_location: questionnaire?.receptionLocation ?? null,
        vendor_notes: questionnaire?.vendorNotes ?? null,
        included_fields: questionnaire?.includedFields?.length ? questionnaire.includedFields : master.fields.map((f) => f.id),
        required_fields: questionnaire?.requiredFields?.length ? questionnaire.requiredFields : master.fields.filter((f) => f.required).map((f) => f.id),
        custom_fields: questionnaire?.customFields ?? [],
        master_overrides: questionnaire?.masterOverrides ?? {},
        field_order: questionnaire?.fieldOrder ?? null,
        additional: questionnaire?.additional ?? null,
      }}
    />
  );
}
