import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LegalVersionForm } from "@/components/hq/legal-version-form";
import {
  getLegalDocumentsForTypeForAdmin,
  isLegalDocumentType,
} from "@/lib/legal/service";
import { LEGAL_DOCUMENT_TYPE_TITLES } from "@/lib/legal/types";

type Props = {
  params: Promise<{ type: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  if (!isLegalDocumentType(type)) return { title: "New Version — Legal" };
  return {
    title: `New ${LEGAL_DOCUMENT_TYPE_TITLES[type]} Version — Legal`,
  };
}

export default async function AdminLegalNewVersionPage({ params }: Props) {
  const { type } = await params;
  if (!isLegalDocumentType(type)) notFound();

  const versions = await getLegalDocumentsForTypeForAdmin(type);
  const latest = versions[0] ?? null;
  const title = LEGAL_DOCUMENT_TYPE_TITLES[type];

  return (
    <div className="space-y-6">
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
            {title}
          </Link>
        </p>
        <h1 className="font-heading text-2xl font-semibold text-heading">
          Publish New Version
        </h1>
        <p className="text-sm text-muted-foreground">
          Appends a new inactive version. Content is locked after creation —
          activate separately when ready to enforce.
        </p>
      </div>

      <LegalVersionForm
        documentType={type}
        defaultTitle={latest?.title ?? title}
        defaultContent={latest?.content}
      />
    </div>
  );
}
