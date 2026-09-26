/**
 * Public purpose-specific form — /forms/{publicKey}
 * Distinct from venue-global inquiry at /form/{embedKey}.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicFormView } from "@/components/form/public-form";
import { getPublicFormConfig } from "@/lib/public-forms/service";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const config = await getPublicFormConfig(token);
  return {
    title: {
      absolute: config ? `${config.form.publicTitle} — ${config.venue.name}` : "Form",
    },
    description: config?.form.description || (config ? `Submit to ${config.venue.name}` : "Submit a form"),
  };
}

export default async function PublicFormPage({ params }: Props) {
  const { token } = await params;
  const config = await getPublicFormConfig(token);
  if (!config) notFound();

  return <PublicFormView publicKey={token} config={config} />;
}
