"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createPublicFormAction } from "@/app/(app)/library/public-forms/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicFormListItem } from "@/lib/public-forms/types";

export function PublicFormList({
  initialForms,
  canEdit = true,
}: {
  initialForms: PublicFormListItem[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [forms] = React.useState(initialForms);
  const [showCreate, setShowCreate] = React.useState(false);
  const [internalName, setInternalName] = React.useState("");
  const [publicTitle, setPublicTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createPublicFormAction({
        internalName,
        publicTitle,
        description,
      });
      if (!result.ok) {
        toast.error(
          result.error === "forbidden"
            ? "Only an Owner or Manager can create public forms."
            : "Could not create form.",
        );
        return;
      }
      toast.success("Public form created.");
      router.push(`/library/public-forms/${result.id}`);
    });
  }

  const active = forms.filter((f) => f.status !== "archived");
  const archived = forms.filter((f) => f.status === "archived");

  return (
    <div className="space-y-6">
      {canEdit && !showCreate && (
        <Button type="button" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> New public form
        </Button>
      )}

      {canEdit && showCreate && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Internal name</Label>
            <Input
              value={internalName}
              onChange={(e) => setInternalName(e.target.value)}
              placeholder="Wedding Expo — September 2026"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Public title</Label>
            <Input
              value={publicTitle}
              onChange={(e) => setPublicTitle(e.target.value)}
              placeholder="Welcome to our Wedding Expo!"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us what you're looking for and we'll follow up."
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={pending || !internalName.trim() || !publicTitle.trim()}
            >
              {pending ? "Creating…" : "Create form"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {forms.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No public forms yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create a purpose-specific lead capture form for an expo, open house, or campaign — then
            share the link or point a QR code at it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((f) => (
            <Link
              key={f.id}
              href={`/library/public-forms/${f.id}`}
              className="block rounded-lg border border-border p-4 transition-colors hover:bg-muted/20"
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-heading">{f.internalName}</p>
                <Badge variant={f.status === "published" ? "default" : "muted"}>
                  {f.status === "published" ? "Published" : "Draft"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Public title: {f.publicTitle} · {f.questionCount} question
                {f.questionCount === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
          {archived.length > 0 && (
            <details className="pt-2">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Archived ({archived.length})
              </summary>
              <div className="mt-2 space-y-3">
                {archived.map((f) => (
                  <Link
                    key={f.id}
                    href={`/library/public-forms/${f.id}`}
                    className="block rounded-lg border border-border p-4 opacity-70"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-heading">{f.internalName}</p>
                      <Badge variant="muted">Archived</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
