"use client";

/**
 * Calendar "Related to" — searchable relationship picker.
 *
 * Replaces the old unbounded-scroll <Select> over every Lead/Client in the
 * venue (Calendar Related-To Search Scalability). No Popover primitive
 * exists in components/ui yet, so this is a small self-contained anchored
 * panel — same click-outside/Escape idiom already used by this app's other
 * overlays (components/shell/command-palette.tsx), and the same debounced-
 * search shape as components/ui/filter-bar.tsx. Matching itself happens
 * server-side (app/(app)/availability/actions.ts's
 * searchScheduleRelationOptionsAction → lib/calendar/service.ts) — a venue
 * with hundreds of relationships never gets more than a query's worth sent
 * to the browser.
 */
import * as React from "react";

import { Loader2, Search, X } from "lucide-react";

import { searchScheduleRelationOptionsAction } from "@/app/(app)/availability/actions";
import {
  groupScheduleRelationOptions,
  hasScheduleRelationResults,
  scheduleRelationOptionKey,
  scheduleRelationSubtitle,
} from "@/lib/calendar/schedule-relation-search";
import type { ScheduleRelationOption } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;

export function ScheduleRelationPicker({
  value,
  onChange,
}: {
  value: ScheduleRelationOption | null;
  onChange: (option: ScheduleRelationOption | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ScheduleRelationOption[]>([]);
  const [searching, setSearching] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function closePicker() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearching(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  function openPicker() {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // Click-outside / Escape to close — no Popover primitive to lean on yet.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) closePicker();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePicker();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // The query changed because of this keystroke — reset synchronously here
  // (a real event handler), not in the effect below, which only ever
  // updates state from its own deferred timer callback.
  function handleQueryChange(next: string) {
    setQuery(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
  }

  // Debounced server-side search — same shape as components/ui/filter-bar.tsx's own.
  React.useEffect(() => {
    const q = query.trim();
    if (!q) return;
    debounceRef.current = setTimeout(() => {
      void (async () => {
        const found = await searchScheduleRelationOptionsAction(q);
        setResults(found);
        setSearching(false);
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function handleSelect(option: ScheduleRelationOption) {
    onChange(option);
    closePicker();
  }

  function handleClearRelation() {
    onChange(null);
    closePicker();
  }

  const groups = groupScheduleRelationOptions(
    results.filter((r) => r.kind === "lead"),
    results.filter((r) => r.kind === "client"),
  );
  const trimmedQuery = query.trim();
  const showResults = trimmedQuery !== "" && !searching;
  const showEmptyState = showResults && !hasScheduleRelationResults(groups);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <button
          type="button"
          onClick={() => (open ? closePicker() : openPicker())}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Related to"
          className={cn(
            "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            value ? "pr-8" : "",
          )}
        >
          <span className={cn("truncate text-left", !value && "text-muted-foreground")}>
            {value ? value.name : "Not related to anyone"}
          </span>
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClearRelation(); }}
            aria-label="Clear related-to"
            className="absolute right-8 top-1/2 z-10 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search leads and clients…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {searching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={handleClearRelation}
              className={cn(
                "flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                !value && "font-medium text-heading",
              )}
            >
              Not related to anyone
            </button>

            {showEmptyState && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">No leads or clients found.</p>
            )}

            {showResults && !showEmptyState && groups.map((group) => group.options.length > 0 && (
              <div key={group.label}>
                <p className="px-3 pt-2 pb-1 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </p>
                {group.options.map((option) => {
                  const subtitle = scheduleRelationSubtitle(option);
                  const selected = !!value && scheduleRelationOptionKey(value) === scheduleRelationOptionKey(option);
                  return (
                    <button
                      key={scheduleRelationOptionKey(option)}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(option)}
                      className={cn(
                        "flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground",
                        selected && "bg-accent/60",
                      )}
                    >
                      <span className="truncate text-sm">{option.name}</span>
                      {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
