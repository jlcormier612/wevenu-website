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
import { getLegalOutstandingAcceptancesForAdmin } from "@/lib/legal/admin-service";

export const metadata: Metadata = {
  title: "Outstanding Acceptances — Legal — Hello to Cheers HQ",
};

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

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminLegalOutstandingPage({
  searchParams,
}: Props) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const role = typeof sp.role === "string" ? sp.role : undefined;
  const documentType =
    typeof sp.document === "string" ? sp.document : undefined;
  const relationshipId =
    typeof sp.relationship === "string" ? sp.relationship : undefined;
  const venueId = typeof sp.venue === "string" ? sp.venue : undefined;

  const rows = await getLegalOutstandingAcceptancesForAdmin({
    search: q,
    role,
    documentType,
    relationshipId,
    venueId,
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
          Outstanding Acceptances
        </h1>
        <p className="text-sm text-muted-foreground">
          Users who still need to accept the currently active legal versions.
        </p>
      </div>

      <Suspense fallback={null}>
        <LegalAdminFilterBar />
      </Suspense>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Relationship</TableHead>
              <TableHead>Required Document</TableHead>
              <TableHead>Current Version</TableHead>
              <TableHead>Accepted Version</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No outstanding acceptances for the current filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={`${row.userId}-${row.documentType}-${row.status}`}
                >
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
                    {row.currentVersion ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.acceptedVersion ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(row.lastLoginAt)}
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                      {row.status === "outdated"
                        ? "Outdated"
                        : "Not accepted"}
                    </span>
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
