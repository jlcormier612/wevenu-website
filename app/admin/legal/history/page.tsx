import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LegalAdminFilterBar } from "@/components/hq/legal-admin-filter-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLegalAcceptanceHistoryForAdmin } from "@/lib/legal/admin-service";

export const metadata: Metadata = {
  title: "Acceptance History — Legal — Hello to Cheers HQ",
};

function formatDateTime(iso: string): string {
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

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLegalHistoryPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const role = typeof sp.role === "string" ? sp.role : undefined;
  const documentType =
    typeof sp.document === "string" ? sp.document : undefined;
  const relationshipId =
    typeof sp.relationship === "string" ? sp.relationship : undefined;

  const rows = await getLegalAcceptanceHistoryForAdmin({
    search: q,
    role,
    documentType,
    relationshipId,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Link href="/admin/legal" className="hover:text-foreground">
            Legal
          </Link>
        </p>
        <h1 className="font-heading text-2xl font-semibold text-heading">
          Acceptance History
        </h1>
        <p className="text-sm text-muted-foreground">
          Append-only audit trail of legal acceptances. Read-only.
        </p>
      </div>

      <Suspense fallback={null}>
        <LegalAdminFilterBar showVenue={false} />
      </Suspense>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Relationship</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Acceptance Method</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No acceptances found for the current filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(row.acceptedAt)}
                  </TableCell>
                  <TableCell className="font-medium text-heading">
                    {row.userLabel}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.roleLabel}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.relationshipLabel}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.documentTitle}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.acceptedVersion}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.acceptanceMethod}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.ipAddress ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
