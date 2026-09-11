import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LibraryPreviewChrome } from "@/components/library/library-preview-chrome";
import { LIBRARY_LABELS } from "@/components/library/labels";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/packages/constants";
import { getPackageStarterMaster } from "@/lib/packages/starters";
import { getPackage } from "@/lib/packages/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const pkg = await getPackage(id);
  return { title: pkg ? `Preview — ${pkg.name}` : "Preview package" };
}

export default async function PackagePreviewPage({ params }: Props) {
  const { id } = await params;
  const pkg = await getPackage(id);
  if (!pkg) notFound();
  const master = pkg.sourceMasterKey ? getPackageStarterMaster(pkg.sourceMasterKey) : undefined;

  return (
    <LibraryPreviewChrome
      caption="Client-facing package presentation preview."
      editHref={`/packages/${pkg.id}`}
      libraryHref="/packages"
      contentMaxWidthClassName="max-w-xl"
    >
      <div className="space-y-4 pb-10">
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-medium text-heading">{pkg.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Package</span>
            {pkg.sourceMasterKey && <Badge variant="muted" className="text-[10px]">{LIBRARY_LABELS.starter}</Badge>}
            <span>· {formatPrice(pkg.basePrice)}</span>
          </div>
          {(pkg.description || master?.description) && (
            <p className="text-sm text-muted-foreground">{pkg.description || master?.description}</p>
          )}
          {pkg.sourceMasterKey && (
            <p className="text-xs text-muted-foreground">
              Hello to Cheers starter — customize spaces, services, and pricing to match your venue. This is a starting structure, not a claim about what you offer.
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-background p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">What&apos;s included</p>
          {pkg.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inclusions listed yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-foreground">
              {pkg.items.map((item) => (
                <li key={item.id} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">•</span>
                  <span>
                    {item.quantity !== 1 && (
                      <span className="text-muted-foreground mr-1">
                        {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                      </span>
                    )}
                    {item.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </LibraryPreviewChrome>
  );
}
