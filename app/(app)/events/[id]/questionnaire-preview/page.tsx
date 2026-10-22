/**
 * Preview as client — uses the real CoupleFamilyQuestionnaireForm rendering.
 * Same-tab preview with an explicit return to the event Questionnaires workspace.
 */
import Link from "next/link";
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
  searchParams: Promise<{ kind?: string; from?: string }>;
}) {
  const { id: eventId } = await params;
  const sp = await searchParams;
  const kind = ((sp.kind as QuestionnaireKind) || "final_details") as QuestionnaireKind;
  const from = sp.from ?? "event";
  const master = getQuestionnaireMasterByKind(kind);
  const [event, questionnaire, venue] = await Promise.all([
    getEvent(eventId),
    getQuestionnaire(eventId, kind),
    getCurrentVenue(),
  ]);
  if (!event || !venue) notFound();

  const backHref = from === "library"
    ? "/library/questionnaire-templates"
    : event.clientId
      ? `/clients/${event.clientId}#questionnaires`
      : `/events/${eventId}#questionnaires`;
  const backLabel = from === "library" ? "Back to Library" : "Back to Questionnaires";

  return (
    <div className="min-h-screen bg-[#F7F5F1]">
      <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview — not sent
            </p>
            <p className="text-sm font-semibold text-heading">{kindLabel(kind)}</p>
          </div>
          <Link
            href={backHref}
            data-testid="questionnaire-preview-back"
            className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            {backLabel}
          </Link>
        </div>
      </div>
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
    </div>
  );
}
