/**
 * Preview as client — uses the real CoupleFamilyQuestionnaireForm rendering.
 * Same-tab preview with an explicit return to Questionnaires / Overview.
 * Form rendering matches the pre-navigation implementation (no wrapper theme).
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

  const questionnairesHref = from === "library"
    ? "/library/questionnaire-templates"
    : event.clientId
      ? `/clients/${event.clientId}#questionnaires`
      : `/events/${eventId}#questionnaires`;
  const questionnairesLabel = from === "library" ? "Back to Library" : "Back to Questionnaires";
  const overviewHref = event.clientId
    ? `/clients/${event.clientId}#overview`
    : `/events/${eventId}#overview`;

  return (
    <>
      {/* Navigation only — do not wrap the form in a substitute theme/background. */}
      <div
        className="sticky top-0 z-20 border-b border-border bg-background"
        data-testid="questionnaire-preview-nav"
      >
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Preview — not sent
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {from !== "library" ? (
              <Link
                href={overviewHref}
                data-testid="questionnaire-preview-back-overview"
                className="inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Back to Overview
              </Link>
            ) : null}
            <Link
              href={questionnairesHref}
              data-testid="questionnaire-preview-back"
              className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              {questionnairesLabel}
            </Link>
          </div>
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
    </>
  );
}
