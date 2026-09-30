"use client";

import * as React from "react";

import { Plus } from "lucide-react";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
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
    <div className="space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
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
      <LibraryHowItWorks>
        Build questions and fields on each form. Submissions create leads. Optionally create a QR campaign that opens this form.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="Questions and fields are edited on the form itself. Create a QR campaign when you want a printable code that opens this form."
        action={{ href: "/library/qr-campaigns", label: "Open QR Campaigns" }}
      >
        QR Campaigns can use these forms as their destination.
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
