"use client";

import * as React from "react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { createLegalVersionAction } from "@/app/admin/legal/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LEGAL_DOCUMENT_TYPE_TITLES,
  type LegalDocumentType,
} from "@/lib/legal/types";

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function LegalVersionForm({
  documentType,
  defaultTitle,
  defaultContent,
}: {
  documentType: LegalDocumentType;
  defaultTitle?: string;
  /** Prefill content from the latest version when creating a successor. */
  defaultContent?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = React.useState(
    defaultTitle ?? LEGAL_DOCUMENT_TYPE_TITLES[documentType],
  );
  const [version, setVersion] = React.useState("");
  const [effectiveDate, setEffectiveDate] = React.useState(todayIsoDate());
  const [content, setContent] = React.useState(defaultContent ?? "");

  function handleCreate() {
    startTransition(async () => {
      const result = await createLegalVersionAction({
        documentType,
        title: title.trim() || LEGAL_DOCUMENT_TYPE_TITLES[documentType],
        version: version.trim(),
        effectiveDate: effectiveDate.trim(),
        content: content.trim(),
      });
      // Successful create redirects; only surface errors here.
      if (result && !result.ok) {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        New versions are created inactive. Content cannot be edited after
        creation — activate when ready, or deactivate without changing text.
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="legal-title">Title</Label>
          <Input
            id="legal-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="legal-version">Version</Label>
          <Input
            id="legal-version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="2026-08-07.2"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="legal-effective">Effective Date</Label>
          <Input
            id="legal-effective"
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="legal-content">Content</Label>
        <Textarea
          id="legal-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={18}
          className="font-mono text-sm"
          placeholder="Paste the full legal document text…"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" disabled={pending} onClick={handleCreate}>
          {pending ? "Creating…" : "Create Version"}
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href={`/admin/legal/${documentType}`} />}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
