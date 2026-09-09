"use client";

import * as React from "react";

import Link from "next/link";
import { FileText, Search } from "lucide-react";

import { ContractStatusBadge } from "@/components/contracts/contract-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatContractDate } from "@/lib/contracts/constants";
import { deriveContractSigningUiState } from "@/lib/contracts/signers";
import type { Contract } from "@/lib/contracts/types";

type FilterKey =
  | "all"
  | "draft"
  | "ready_to_send"
  | "awaiting_client_signature"
  | "fully_signed"
  | "cancelled";

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "ready_to_send", label: "Ready to send" },
  { value: "awaiting_client_signature", label: "Awaiting client signature" },
  { value: "fully_signed", label: "Fully signed" },
  { value: "cancelled", label: "Cancelled" },
];

function contractFilterKey(c: Contract): FilterKey {
  if (c.status === "cancelled") return "cancelled";
  if (c.status === "expired") return "cancelled";
  const progressive = deriveContractSigningUiState({
    status: c.status,
    venueSigned: c.venueSigned ?? false,
    requiredClientTotal: c.requiredClientTotal ?? 1,
    requiredClientSigned: c.requiredClientSigned ?? 0,
    expiresAt: c.expiresAt,
  });
  if (progressive.state === "fully_signed") return "fully_signed";
  if (progressive.state === "awaiting_client_signature") return "awaiting_client_signature";
  if (progressive.state === "ready_to_send") return "ready_to_send";
  if (progressive.state === "draft") return "draft";
  return "all";
}

export function ContractList({ contracts }: { contracts: Contract[] }) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase();
    return contracts.filter((c) => {
      if (filter !== "all" && contractFilterKey(c) !== filter) return false;
      if (!q) return true;
      return [c.title, c.clientName].some((s) => s?.toLowerCase().includes(q));
    });
  }, [contracts, query, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contracts…" className="pl-9" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(({ value, label }) => {
          const count = value === "all"
            ? contracts.length
            : contracts.filter((c) => contractFilterKey(c) === value).length;
          const active = filter === value;
          return (
            <button key={value} type="button" onClick={() => setFilter(value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
              {label}
              <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {contracts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText className="h-5 w-5" />
          </span>
          <p className="font-heading text-lg font-medium text-heading">No contracts yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Create your first contract from a template.
          </p>
          <Button render={<Link href="/contracts/new" />}>+ New Contract</Button>
        </div>
      )}

      {contracts.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No contracts match your filters.</p>
          <Button variant="link" size="sm" className="mt-1" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contract) => (
                <TableRow key={contract.id} className="group">
                  <TableCell className="font-medium text-foreground">
                    <Link href={`/contracts/${contract.id}`} className="hover:text-primary">{contract.title}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {contract.clientName
                      ? <Link href={`/clients/${contract.clientId}`} className="hover:text-primary">{contract.clientName}</Link>
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {contract.eventDate ? formatContractDate(contract.eventDate) : "—"}
                  </TableCell>
                  <TableCell>
                    <ContractStatusBadge
                      status={contract.status}
                      executionOrigin={contract.executionOrigin}
                      venueSigned={contract.venueSigned}
                      requiredClientTotal={contract.requiredClientTotal}
                      requiredClientSigned={contract.requiredClientSigned}
                      expiresAt={contract.expiresAt}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatContractDate(contract.createdAt.slice(0, 10))}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" render={<Link href={`/contracts/${contract.id}`} />}>View →</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
