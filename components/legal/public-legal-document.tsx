import type { ReactNode } from "react";

import {
  getActiveLegalDocument,
} from "@/lib/legal/service";
import {
  LEGAL_DOCUMENT_TYPE_TITLES,
  type LegalDocument,
  type LegalDocumentType,
} from "@/lib/legal/types";

function PublicLegalShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-svh bg-background px-4 py-12 md:px-8 md:py-16">
      <article className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2 border-b border-border pb-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Legal
          </p>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-heading md:text-4xl">
            {title}
          </h1>
          {children}
        </header>
      </article>
    </main>
  );
}

/**
 * Presentational viewer for an active legal document (or unavailable state).
 */
export function PublicLegalDocumentView({
  document,
  fallbackTitle,
}: {
  document: LegalDocument | null;
  fallbackTitle: string;
}) {
  if (!document) {
    return (
      <PublicLegalShell title={fallbackTitle}>
        <p className="text-sm text-muted-foreground">
          This document is currently unavailable. Please check back later.
        </p>
      </PublicLegalShell>
    );
  }

  // DB `title` is immutable after insert; chrome headings use the type label
  // so public-site renames (e.g. terms_of_service) don't require a new version.
  const headingTitle =
    document.documentType === "terms_of_service" ||
    document.documentType === "couple_end_user_terms" ||
    document.documentType === "vendor_end_user_terms"
      ? LEGAL_DOCUMENT_TYPE_TITLES[document.documentType]
      : document.title;

  return (
    <main className="min-h-svh bg-background px-4 py-12 md:px-8 md:py-16">
      <article className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2 border-b border-border pb-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Legal
          </p>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-heading md:text-4xl">
            {headingTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            Version {document.version} · Effective {document.effectiveDate}
          </p>
        </header>
        <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
          {document.content}
        </div>
      </article>
    </main>
  );
}

/**
 * Server page body: loads the active version for a document type.
 */
export async function PublicLegalDocumentPage({
  documentType,
}: {
  documentType: LegalDocumentType;
}) {
  const document = await getActiveLegalDocument(documentType);
  return (
    <PublicLegalDocumentView
      document={document}
      fallbackTitle={LEGAL_DOCUMENT_TYPE_TITLES[documentType]}
    />
  );
}
