/**
 * Public purpose-specific form — /forms/{publicKey}
 * Distinct from venue-global inquiry at /form/{embedKey}.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicFormUnavailable, PublicFormView } from "@/components/form/public-form";
import { getPublicFormConfig, getPublicFormUnavailableState } from "@/lib/public-forms/service";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const config = await getPublicFormConfig(token);
  if (config) {
    return {
      title: {
        absolute: `${config.form.publicTitle} — ${config.venue.name}`,
      },
      description: config.form.description || `Submit to ${config.venue.name}`,
    };
  }
  const unavailable = await getPublicFormUnavailableState(token);
  return {
    title: {
      absolute: unavailable ? `${unavailable.publicTitle}` : "Form",
    },
    description: "This form is not available.",
  };
}

export default async function PublicFormPage({ params }: Props) {
  const { token } = await params;
  const config = await getPublicFormConfig(token);
  if (config) {
    return <PublicFormView publicKey={token} config={config} />;
  }
  const unavailable = await getPublicFormUnavailableState(token);
  if (!unavailable) notFound();
  return <PublicFormUnavailable state={unavailable} />;
}
