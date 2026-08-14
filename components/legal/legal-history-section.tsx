import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LegalAcceptanceHistoryItem } from "@/lib/legal/types";

function formatAcceptedOn(iso: string): string {
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

/** Shared read-only table for Legal History rows. */
export function LegalHistoryTable({
  items,
}: {
  items: LegalAcceptanceHistoryItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No legal acceptances yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Accepted On</TableHead>
            <TableHead>Acceptance Method</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.documentTitle}</TableCell>
              <TableCell>{row.acceptedVersion}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatAcceptedOn(row.acceptedAt)}
              </TableCell>
              <TableCell>{row.acceptanceMethod}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Venue settings Card wrapper — matches other /settings sections.
 * Read-only; no mutate UI.
 */
export function LegalHistorySection({
  items,
}: {
  items: LegalAcceptanceHistoryItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Legal History</CardTitle>
        <CardDescription>
          Documents you have accepted, newest first. This record cannot be
          edited.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LegalHistoryTable items={items} />
      </CardContent>
    </Card>
  );
}

/**
 * Vendor profile panel — matches vendor profile card chrome.
 */
export function VendorLegalHistorySection({
  items,
}: {
  items: LegalAcceptanceHistoryItem[];
}) {
  return (
    <div className="space-y-3 rounded-sm border border-border bg-card p-6">
      <div>
        <p className="text-sm font-medium text-heading">Legal History</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Documents you have accepted, newest first.
        </p>
      </div>
      <LegalHistoryTable items={items} />
    </div>
  );
}

/**
 * Couple portal Account panel — matches portal account card chrome.
 */
export function PortalLegalHistorySection({
  items,
}: {
  items: LegalAcceptanceHistoryItem[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-heading">Legal History</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Documents you have accepted, newest first.
        </p>
      </div>
      <LegalHistoryTable items={items} />
    </div>
  );
}
