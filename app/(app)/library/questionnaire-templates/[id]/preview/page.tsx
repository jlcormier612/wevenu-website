/**
 * Library preview — real couple renderer with resolved template fields.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CoupleFamilyQuestionnaireForm } from "@/components/form/couple-family-questionnaire-form";
import { Button } from "@/components/ui/button";
import { getQuestionnaireMasterByKind } from "@/lib/questionnaire-family/definitions";
import { getTemplate } from "@/lib/questionnaire-templates/service";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template ? `Preview — ${template.name}` : "Preview questionnaire" };
}

export default async function QuestionnaireTemplatePreviewPage({ params }: Props) {
  const { id } = await params;
  const [template, venue] = await Promise.all([getTemplate(id), getCurrentVenue()]);
  if (!template || !venue) notFound();

  const master = getQuestionnaireMasterByKind(template.kind);
  const included = template.includedFields.length
    ? template.includedFields
    : master.fields.map((f) => f.id);
  const required = template.requiredFields.length
    ? template.requiredFields
    : master.fields.filter((f) => f.required).map((f) => f.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 max-w-xl mx-auto">
        <p className="text-sm text-muted-foreground">Preview as your clients will see it</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" render={<Link href={`/library/questionnaire-templates/${template.id}`} />}>
            Back to edit
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/library/questionnaire-templates" />}>
            Library
          </Button>
        </div>
      </div>
      <CoupleFamilyQuestionnaireForm
        accessKey=""
        previewMode
        data={{
          questionnaire_id: `preview-${template.id}`,
          kind: template.kind,
          event_name: "Sample celebration",
          event_date: null,
          event_guest_count: 120,
          venue_name: venue.name,
          venue_logo_url: venue.logoUrl || null,
          venue_primary_color: venue.primaryColor,
          public_review_url: null,
          status: "sent",
          final_guest_count: null,
          meal_notes: null,
          processional_song: null,
          recessional_song: null,
          first_dance_song: null,
          parent_dances: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          special_requests: null,
          included_fields: included,
          required_fields: required,
          custom_fields: template.customFields,
          master_overrides: template.masterOverrides,
          field_order: template.fieldOrder,
          additional: null,
          known_vendors: [{ name: "Example Florist", role: "Florist" }],
          client_primary_name: "Alex & Jordan",
        }}
      />
    </div>
  );
}
