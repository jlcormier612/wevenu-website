"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  activateLegalVersionAction,
  deactivateLegalVersionAction,
} from "@/app/admin/legal/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canDeactivateLegalVersion } from "@/lib/legal/admin-helpers";
import type { LegalAdminVersionHistoryRow } from "@/lib/legal/admin-helpers";
import type { LegalDocumentType } from "@/lib/legal/types";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.includes("T") ? new Date(iso) : new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LegalVersionsTable({
  documentType,
  versions,
}: {
  documentType: LegalDocumentType;
  versions: LegalAdminVersionHistoryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const activeCount = versions.filter((v) => v.isActive).length;

  function handleActivate(id: string) {
    if (
      !confirm(
        "Activate this version? The previous active version of this document will be deactivated.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await activateLegalVersionAction(id, documentType);
      if (result.ok) {
        toast.success("Version activated.");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleDeactivate(id: string) {
    if (
      !confirm(
        "Deactivate this version? Only allowed when another active version already exists.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deactivateLegalVersionAction(id, documentType);
      if (result.ok) {
        toast.success("Version deactivated.");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border py-16">
        <p className="text-sm font-medium text-heading">No versions yet</p>
        <p className="text-xs text-muted-foreground">
          Publish the first version to start managing this document.
        </p>
        <Button
          render={<Link href={`/admin/legal/${documentType}/new`} />}
          className="mt-2"
        >
          Publish New Version
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Effective Date</TableHead>
            <TableHead>Published By</TableHead>
            <TableHead>Published On</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Acceptance Count</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((v) => {
            const canDeactivate = canDeactivateLegalVersion({
              isActive: v.isActive,
              activeCountForType: activeCount,
            });
            return (
              <TableRow key={v.id}>
                <TableCell className="font-medium text-heading">
                  {v.version}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(v.effectiveDate)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.publishedByLabel ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(v.publishedAt)}
                </TableCell>
                <TableCell>
                  {v.isActive ? (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                      Active
                    </span>
                  ) : v.isPublished ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Published
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Draft
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {v.acceptanceCount}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="xs"
                      render={
                        <Link
                          href={`/admin/legal/${documentType}/${v.id}`}
                        />
                      }
                    >
                      View
                    </Button>
                    {v.isActive ? (
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={pending || !canDeactivate}
                        title={
                          canDeactivate
                            ? undefined
                            : "Cannot deactivate the only active version"
                        }
                        onClick={() => handleDeactivate(v.id)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={pending}
                        onClick={() => handleActivate(v.id)}
                      >
                        Activate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
