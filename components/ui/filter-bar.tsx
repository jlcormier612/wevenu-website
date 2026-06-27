"use client";

/**
 * Shared FilterBar — URL-based filtering for list pages.
 *
 * Updates search params on the current route without a full navigation.
 * Works with any server component that reads searchParams.
 */

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

export function FilterBar({
  placeholder = "Search…",
  statusOptions,
  statusParam = "status",
  searchParam = "q",
  className,
}: {
  placeholder?: string;
  statusOptions?: FilterOption[];
  statusParam?: string;
  searchParam?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = React.useState(searchParams.get(searchParam) ?? "");
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentStatus = searchParams.get(statusParam) ?? "";
  const hasFilters = !!(query || currentStatus);

  function push(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => push({ [searchParam]: value }), 350);
  }

  function handleStatusChange(value: string) {
    push({ [statusParam]: value === "__all__" ? "" : value });
  }

  function handleClear() {
    setQuery("");
    const params = new URLSearchParams();
    router.push(pathname + (params.toString() ? `?${params}` : ""));
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={placeholder}
          className="pl-8 h-8 text-sm"
        />
      </div>

      {statusOptions && (
        <Select value={currentStatus || "__all__"} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-8 text-sm w-40">
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button type="button" variant="ghost" size="sm" onClick={handleClear}
          className="h-8 text-muted-foreground hover:text-foreground">
          <X className="mr-1 h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
