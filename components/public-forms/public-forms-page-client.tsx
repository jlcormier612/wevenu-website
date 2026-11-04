"use client";

import * as React from "react";

import { Plus } from "lucide-react";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote } from "@/components/library/library-guidance";
import { PublicFormList } from "@/components/public-forms/public-form-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import type { PublicFormListItem } from "@/lib/public-forms/types";

export function PublicFormsPageClient({
  forms,
  appUrl,
  canEdit,
}: {
  forms: PublicFormListItem[];
  appUrl: string;
  canEdit: boolean;
}) {
  const listRef = React.useRef<{ openCreate: () => void } | null>(null);

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Public Forms"
          description="Purpose-specific lead capture forms — separate from your main inquiry form."
          actions={
            canEdit ? (
              <Button type="button" onClick={() => listRef.current?.openCreate()}>
                <Plus className="mr-1 h-4 w-4" /> Create form
              </Button>
            ) : undefined
          }
        />
      </div>
      <LibraryDependencyNote
        tone="calm"
        detail="Questions and fields are edited on the form itself. Submissions create leads. Create a QR campaign when you want a printable code that opens this form."
        action={{ href: "/library/qr-campaigns", label: "Open QR Campaigns" }}
      >
        How Public Forms work
      </LibraryDependencyNote>
      <PublicFormList
        ref={listRef}
        initialForms={forms}
        appUrl={appUrl}
        canEdit={canEdit}
        headerCreate={false}
      />
    </div>
  );
}
