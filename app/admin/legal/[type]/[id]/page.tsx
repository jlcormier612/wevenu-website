import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LegalVersionActions } from "@/components/hq/legal-version-actions";
import { Button } from "@/components/ui/button";
import {
  getLegalDocumentsForTypeForAdmin,
  getLegalDocumentForAdmin,
  isLegalDocumentType,
} from "@/lib/legal/service";
import { LEGAL_DOCUMENT_TYPE_TITLES } from "@/lib/legal/types";

type Props = {
  params: Promise<{ type: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, id } = await params;
  if (!isLegalDocumentType(type)) return { title: "Legal Version" };
  const doc = await getLegalDocumentForAdmin(id);
  if (!doc) return { title: LEGAL_DOCUMENT_TYPE_TITLES[type] };
  const chromeTitle =
    type === "terms_of_service" ||
    type === "couple_end_user_terms" ||
    type === "vendor_end_user_terms"
      ? LEGAL_DOCUMENT_TYPE_TITLES[type]
      : doc.title;
  return {
    title: `${chromeTitle} v${doc.version} — Legal`,
  };
}

function formatDate(iso: string): string {
  const d = iso.includes("T") ? new Date(iso) : new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Read-only view of a single legal document version.
 * Content is never editable here — create a new version to change text.
 */
export default async function AdminLegalVersionPage({ params }: Props) {
  const { type, id } = await params;
  if (!isLegalDocumentType(type)) notFound();

  const doc = await getLegalDocumentForAdmin(id);
  if (!doc || doc.documentType !== type) notFound();

  const siblings = await getLegalDocumentsForTypeForAdmin(type);
  const activeCount = siblings.filter((v) => v.isActive).length;

  const typeTitle = LEGAL_DOCUMENT_TYPE_TITLES[type];
  const headingTitle =
    type === "terms_of_service" ||
    type === "couple_end_user_terms" ||
    type === "vendor_end_user_terms"
      ? typeTitle
      : doc.title;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Link href="/admin/legal" className="hover:text-foreground">
              Legal
            </Link>
            {" · "}
            <Link
              href={`/admin/legal/${type}`}
              className="hover:text-foreground"
            >
              {typeTitle}
            </Link>
          </p>
          <h1 className="font-heading text-2xl font-semibold text-heading">
            {headingTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            Version {doc.version} · Effective {formatDate(doc.effectiveDate)} ·{" "}
            {doc.isActive ? "Active" : doc.isPublished ? "Published" : "Draft"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LegalVersionActions
            id={doc.id}
            documentType={type}
            isActive={doc.isActive}
            activeCountForType={activeCount}
          />
          <Button
            variant="outline"
            render={<Link href={`/admin/legal/${type}/new`} />}
          >
            Publish New Version
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        This version is read-only. To change the text, publish a new version.
      </div>

      <article className="rounded-xl border px-5 py-6">
        <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
          {doc.content}
        </div>
      </article>
    </div>
  );
}
