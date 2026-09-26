"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  archivePublicFormAction,
  createPublicFormAction,
  duplicatePublicFormAction,
} from "@/app/(app)/library/public-forms/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicFormAbsoluteUrl } from "@/lib/public-forms/public-url";
import type { PublicFormListItem } from "@/lib/public-forms/types";

function statusLabel(status: PublicFormListItem["status"]): string {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PublicFormList({
  initialForms,
  appUrl,
  canEdit = true,
}: {
  initialForms: PublicFormListItem[];
  appUrl: string;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [forms, setForms] = React.useState(initialForms);
  const [showCreate, setShowCreate] = React.useState(false);
  const [internalName, setInternalName] = React.useState("");
  const [publicTitle, setPublicTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setForms(initialForms);
  }, [initialForms]);

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
      toast.success("Form created as a draft.");
      router.push(`/library/public-forms/${result.id}`);
    });
  }

  function handleCopy(url: string) {
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied."),
      () => toast.error("Could not copy link."),
    );
  }

  function handleDuplicate(id: string) {
    startTransition(async () => {
      const result = await duplicatePublicFormAction(id);
      if (!result.ok) {
        toast.error("Could not duplicate form.");
        return;
      }
      toast.success("Duplicate created as a draft.");
      router.push(`/library/public-forms/${result.id}`);
    });
  }

  function handleArchive(id: string) {
    startTransition(async () => {
      const result = await archivePublicFormAction(id);
      if (!result.ok) {
        toast.error("Could not archive form.");
        return;
      }
      toast.success("Form archived.");
      router.refresh();
    });
  }

  const active = forms.filter((f) => f.status !== "archived");
  const archived = forms.filter((f) => f.status === "archived");

  return (
    <div className="space-y-6">
      {canEdit && !showCreate && (
        <Button type="button" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> Create form
        </Button>
      )}

      {canEdit && showCreate && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Form name</Label>
            <Input
              value={internalName}
              onChange={(e) => setInternalName(e.target.value)}
              placeholder="Wedding Expo"
            />
            <p className="text-[11px] text-muted-foreground">Staff-only name for your list.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Title people will see</Label>
            <Input
              value={publicTitle}
              onChange={(e) => setPublicTitle(e.target.value)}
              placeholder="Wedding Expo Registration"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Instructions</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us what you're planning and we'll follow up."
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
            Create a form, publish it, then share the link or create QR codes. Responses become leads.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((f) => {
            const url = publicFormAbsoluteUrl(f.publicKey, appUrl);
            return (
              <div key={f.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Link href={`/library/public-forms/${f.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-heading">{f.internalName}</p>
                      <Badge variant={f.status === "published" ? "default" : "muted"}>
                        {statusLabel(f.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {f.publicTitle} · {f.questionCount} question{f.questionCount === 1 ? "" : "s"}
                      {" · "}
                      {f.qrCount} QR code{f.qrCount === 1 ? "" : "s"}
                      {" · "}
                      {f.leadCount} lead{f.leadCount === 1 ? "" : "s"}
                      {f.updatedAt ? ` · Updated ${formatDate(f.updatedAt)}` : ""}
                    </p>
                    {f.status === "published" && url ? (
                      <p className="mt-1 break-all text-[11px] text-muted-foreground">{url}</p>
                    ) : (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Not live yet — publish to share the link.
                      </p>
                    )}
                  </Link>
                  {canEdit && (
                    <div className="flex flex-wrap gap-1">
                      <Link
                        href={`/library/public-forms/${f.id}`}
                        className="inline-flex h-7 items-center rounded-lg px-2.5 text-[0.8rem] hover:bg-muted"
                      >
                        Edit
                      </Link>
                      {f.status === "published" && url && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleCopy(url)}>
                          Copy link
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleDuplicate(f.id)} disabled={pending}>
                        Duplicate
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleArchive(f.id)} disabled={pending}>
                        Archive
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
                    <p className="mt-1 text-xs text-muted-foreground">
                      {f.leadCount} lead{f.leadCount === 1 ? "" : "s"} kept · {f.qrCount} QR code
                      {f.qrCount === 1 ? "" : "s"} still listed
                    </p>
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
