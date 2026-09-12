import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrochurePreviewView } from "@/components/brochures/brochure-preview-view";
import { LibraryPreviewChrome } from "@/components/library/library-preview-chrome";
import { Button } from "@/components/ui/button";
import { getBrochureRenderData } from "@/lib/brochures/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getBrochureRenderData(id);
  return { title: data ? `Preview — ${data.brochure.name}` : "Preview brochure" };
}

export default async function BrochurePreviewPage({ params }: Props) {
  const { id } = await params;
  const data = await getBrochureRenderData(id);
  if (!data) notFound();

  return (
    <LibraryPreviewChrome
      caption="Preview of this brochure. Packages and FAQs update live from your current venue data."
      editHref={`/library/brochures/${data.brochure.id}`}
      libraryHref="/library/brochures"
      contentMaxWidthClassName="max-w-2xl"
      actions={
        <Button
          size="sm"
          variant="outline"
          render={<Link href={`/api/brochures/${data.brochure.id}/pdf`} target="_blank" rel="noopener noreferrer" />}
        >
          Download PDF
        </Button>
      }
    >
      <BrochurePreviewView data={data} />
    </LibraryPreviewChrome>
  );
}
