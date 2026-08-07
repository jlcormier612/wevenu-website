import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LegalVersionsTable } from "@/components/hq/legal-versions-table";
import { Button } from "@/components/ui/button";
import { getLegalVersionHistoryForAdmin } from "@/lib/legal/admin-service";
import { isLegalDocumentType } from "@/lib/legal/service";
import { LEGAL_DOCUMENT_TYPE_TITLES } from "@/lib/legal/types";

type Props = {
  params: Promise<{ type: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type } = await params;
  if (!isLegalDocumentType(type)) return { title: "Legal — Hello to Cheers HQ" };
  return {
    title: `${LEGAL_DOCUMENT_TYPE_TITLES[type]} — Legal — Hello to Cheers HQ`,
  };
}

export default async function AdminLegalTypePage({ params }: Props) {
  const { type } = await params;
  if (!isLegalDocumentType(type)) notFound();

  const versions = await getLegalVersionHistoryForAdmin(type);
  const title = LEGAL_DOCUMENT_TYPE_TITLES[type];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Link href="/admin/legal" className="hover:text-foreground">
              Legal
            </Link>
          </p>
          <h1 className="font-heading text-2xl font-semibold text-heading">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Version history for this document. Newest first. Only one version
            can be active at a time.
          </p>
        </div>
        <Button render={<Link href={`/admin/legal/${type}/new`} />}>
          Publish New Version
        </Button>
      </div>

      <LegalVersionsTable documentType={type} versions={versions} />
    </div>
  );
}
