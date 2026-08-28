/**
 * Public inquiry form — /form/{embedKey}
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InquiryForm } from "@/components/form/inquiry-form";
import { getPublicInquiryFormConfig } from "@/lib/inquiry-form/service";
import type { InquiryMode } from "@/lib/inquiry-form/types";

type Props = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ mode?: string }>;
};

function resolveModeParam(mode: string | undefined): InquiryMode | null {
  if (mode === "tour") return "schedule_tour";
  if (mode === "info" || mode === "information") return "request_information";
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const config = await getPublicInquiryFormConfig(key);
  return {
    title: { absolute: config ? `Inquire — ${config.venue.name}` : "Venue Inquiry" },
    description: config ? `Submit an inquiry to ${config.venue.name}` : "Submit an inquiry",
  };
}

export default async function PublicFormPage({ params, searchParams }: Props) {
  const { key } = await params;
  const { mode } = await searchParams;
  const config = await getPublicInquiryFormConfig(key);
  if (!config) notFound();

  return (
    <InquiryForm
      embedKey={key}
      config={config}
      initialMode={resolveModeParam(mode)}
    />
  );
}
