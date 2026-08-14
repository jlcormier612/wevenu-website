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
import type { LegalDocumentTypeSummary } from "@/lib/legal/types";

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

function StatusBadge({
  current,
}: {
  current: LegalDocumentTypeSummary["current"];
}) {
  if (!current) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        Missing
      </span>
    );
  }
  if (current.isActive) {
    return (
      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
        Active
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      Inactive
    </span>
  );
}

export function LegalDocumentsTable({
  rows,
}: {
  rows: LegalDocumentTypeSummary[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleActivate(id: string, documentType: string) {
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

  function handleDeactivate(id: string, documentType: string) {
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

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Current Version</TableHead>
            <TableHead>Effective Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const current = row.current;
            const canDeactivate =
              !!current &&
              canDeactivateLegalVersion({
                isActive: current.isActive,
                activeCountForType: row.activeCount,
              });
            return (
              <TableRow key={row.documentType}>
                <TableCell className="font-medium text-heading">
                  <Link
                    href={`/admin/legal/${row.documentType}`}
                    className="hover:underline"
                  >
                    {row.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {current?.version ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(current?.effectiveDate)}
                </TableCell>
                <TableCell>
                  <StatusBadge current={current} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {current ? (current.isPublished ? "Yes" : "No") : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(current?.updatedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {current ? (
                      <Button
                        variant="outline"
                        size="xs"
                        render={
                          <Link
                            href={`/admin/legal/${row.documentType}/${current.id}`}
                          />
                        }
                      >
                        View
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        render={
                          <Link href={`/admin/legal/${row.documentType}`} />
                        }
                      >
                        View
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="xs"
                      render={
                        <Link href={`/admin/legal/${row.documentType}`} />
                      }
                    >
                      View History
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      render={
                        <Link
                          href={`/admin/legal/${row.documentType}/new`}
                        />
                      }
                    >
                      Publish New Version
                    </Button>
                    {current && !current.isActive ? (
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={pending}
                        onClick={() =>
                          handleActivate(current.id, row.documentType)
                        }
                      >
                        Activate
                      </Button>
                    ) : null}
                    {current?.isActive ? (
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={pending || !canDeactivate}
                        title={
                          canDeactivate
                            ? undefined
                            : "Cannot deactivate the only active version"
                        }
                        onClick={() =>
                          handleDeactivate(current.id, row.documentType)
                        }
                      >
                        Deactivate
                      </Button>
                    ) : null}
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
