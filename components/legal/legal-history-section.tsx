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
      <p className="text-sm text-muted-foreground" data-testid="legal-history-empty">
        No legal documents accepted yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="legal-history-table">
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
              <TableCell className="font-medium">{row.documentTitle || "Legal document"}</TableCell>
              <TableCell>{row.acceptedVersion || "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatAcceptedOn(row.acceptedAt)}
              </TableCell>
              <TableCell>{row.acceptanceMethod || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Stacked cards — readable on narrow portal screens (no empty header-only rows). */
export function LegalHistoryCards({
  items,
}: {
  items: LegalAcceptanceHistoryItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="legal-history-empty">
        No legal documents accepted yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-testid="legal-history-cards">
      {items.map((row) => (
        <li
          key={row.id}
          className="rounded-xl border border-border/60 px-3 py-2.5 space-y-0.5"
        >
          <p className="text-sm font-medium text-heading">
            {row.documentTitle || "Legal document"}
          </p>
          <p className="text-xs text-muted-foreground">
            Version {row.acceptedVersion || "—"}
            {" · "}
            Accepted {formatAcceptedOn(row.acceptedAt)}
          </p>
          {row.acceptanceMethod ? (
            <p className="text-[11px] text-muted-foreground">{row.acceptanceMethod}</p>
          ) : null}
        </li>
      ))}
    </ul>
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
  loading = false,
  error = null,
}: {
  items: LegalAcceptanceHistoryItem[];
  loading?: boolean;
  error?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="portal-legal-history">
      <div>
        <p className="text-sm font-semibold text-heading">Legal History</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Documents you have accepted, newest first.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground" data-testid="legal-history-loading">
          Loading legal history…
        </p>
      ) : error ? (
        <p className="text-sm text-destructive" role="alert" data-testid="legal-history-error">
          {error}
        </p>
      ) : (
        <LegalHistoryCards items={items} />
      )}
    </div>
  );
}
