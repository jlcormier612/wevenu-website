import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import { BrochurePreviewView } from "@/components/brochures/brochure-preview-view";
import { getBrochureRenderDataByToken } from "@/lib/brochures/service";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: { absolute: "Brochure" } };

export default async function BrochurePage({ params }: Props) {
  const { token } = await params;
  const data = await getBrochureRenderDataByToken(token);
  if (!data) notFound();

  const brandColor = data.venue.primaryColor || "#5D6F5D";
  const brandStyle: CSSProperties = { ["--brand" as string]: brandColor };

  return (
    <div className="min-h-screen bg-white py-10" style={brandStyle}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <BrochurePreviewView data={data} />
      </div>
    </div>
  );
}
