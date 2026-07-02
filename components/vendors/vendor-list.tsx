"use client";

import * as React from "react";

import Link from "next/link";
import { ArrowUpDown, Search } from "lucide-react";

import { VendorCategoryBadge } from "@/components/vendors/vendor-category-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { VENDOR_CATEGORIES, vendorCategoryLabel } from "@/lib/vendors/constants";
import type { Vendor } from "@/lib/vendors/types";

type FilterKey = "all" | string;
type SortKey = "az" | "za" | "newest" | "preferred";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "az",        label: "A → Z" },
  { value: "za",        label: "Z → A" },
  { value: "preferred", label: "Preferred First" },
  { value: "newest",    label: "Recently Added" },
];

export function VendorList({ vendors }: { vendors: Vendor[] }) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [sort, setSort] = React.useState<SortKey>("az");

  const categories = React.useMemo(() => {
    const used = new Set(vendors.map((v) => v.category).filter(Boolean));
    return VENDOR_CATEGORIES.filter((c) => used.has(c.value));
  }, [vendors]);

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase();
    const base = vendors.filter((v) => {
      if (filter !== "all" && v.category !== filter) return false;
      if (!q) return true;
      return [v.name, v.contactName, v.email, v.category]
        .some((s) => s?.toLowerCase().includes(q));
    });
    return [...base].sort((a, b) => {
      switch (sort) {
        case "za":        return b.name.localeCompare(a.name);
        case "preferred": {
          const lvl = (v: Vendor) => v.preferenceLevel === "featured" ? 2 : v.preferenceLevel === "preferred" ? 1 : 0;
          return lvl(b) - lvl(a) || a.name.localeCompare(b.name);
        }
        case "newest":    return (b.createdAt ?? "") < (a.createdAt ?? "") ? -1 : 1;
        default:          return a.name.localeCompare(b.name);
      }
    });
  }, [vendors, query, filter, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors…" className="pl-9" />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-9 w-40 text-sm border-border">
              <SelectValue placeholder="A → Z" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...categories.map((c) => c.value)] as FilterKey[]).map((key) => {
            const label = key === "all" ? "All" : vendorCategoryLabel(key);
            const count = key === "all" ? vendors.length : vendors.filter((v) => v.category === key).length;
            const active = filter === key;
            return (
              <button key={key} type="button" onClick={() => setFilter(key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                {label}
                <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {vendors.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No vendors yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            Build your vendor directory to quickly assign team members to events.
          </p>
          <Button render={<Link href="/vendors/new" />}>+ Add Vendor</Button>
        </div>
      )}

      {vendors.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm text-muted-foreground">No vendors match your search.</p>
          <Button variant="link" size="sm" className="mt-1"
            onClick={() => { setQuery(""); setFilter("all"); }}>
            Clear filters
          </Button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((vendor) => (
                <TableRow key={vendor.id} className="group">
                  <TableCell className="font-medium text-foreground">
                    <Link href={`/vendors/${vendor.id}`} className="hover:text-primary">
                      {vendor.name}
                    </Link>
                  </TableCell>
                  <TableCell><VendorCategoryBadge category={vendor.category} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {vendor.contactName ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {vendor.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    {vendor.preferenceLevel === "featured" && (
                      <Badge className="gap-1 bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                        ⭐ Featured
                      </Badge>
                    )}
                    {vendor.preferenceLevel === "preferred" && (
                      <Badge variant="outline" className="gap-1 text-[#3D5040] border-[#5D6F5D]/30">
                        ✓ Preferred
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm"
                      render={<Link href={`/vendors/${vendor.id}`} />}>
                      View →
                    </Button>
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
