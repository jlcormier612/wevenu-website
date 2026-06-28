/**
 * Public questionnaire page — /questionnaire/{access_key}
 *
 * No auth required. Couple fills in their final details and submits.
 * Responses update event_questionnaires directly via SECURITY DEFINER.
 * Page load fires mark_questionnaire_opened() to track the first open (intent signal).
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CoupleQuestionnaireForm } from "@/components/form/couple-questionnaire-form";
import { createClient } from "@/integrations/supabase/server";

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_questionnaire_for_couple", { p_key: key });
  const row = data?.[0];
  return row
    ? { title: `Final Details — ${row.event_name} · ${row.venue_name}` }
    : { title: "Final Details Form" };
}

export default async function CouplequestionnairePage({ params }: Props) {
  const { key } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_questionnaire_for_couple", { p_key: key });
  const row = data?.[0];
  if (!row) notFound();

  // Track that the form was opened (intent signal — fire-and-forget)
  void supabase.rpc("mark_questionnaire_opened", { p_key: key });

  return <CoupleQuestionnaireForm accessKey={key} data={row} />;
}
