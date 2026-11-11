"use client";

/**
 * New Request client field — searchable, server-side, venue-scoped.
 * Same debounced anchored-panel idiom as ScheduleRelationPicker
 * (Calendar Related-To Search Scalability). Never loads the full client list.
 */
import * as React from "react";

import { Loader2, Search, X } from "lucide-react";

import { searchRequestClientsAction } from "@/app/(app)/requests/actions";
import {
  requestClientSubtitle,
  type RequestClientOption,
} from "@/lib/requests/client-search";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;

export function RequestClientPicker({
  value,
  onChange,
}: {
  value: RequestClientOption | null;
  onChange: (option: RequestClientOption | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<RequestClientOption[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [highlight, setHighlight] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = React.useRef(0);

  function closePicker() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearching(false);
    setError(null);
    setHighlight(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  function openPicker() {
    setOpen(true);
    setError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

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

  function handleQueryChange(next: string) {
    setQuery(next);
    setError(null);
    setHighlight(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!next.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
  }

  React.useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const seq = ++searchSeqRef.current;
    debounceRef.current = setTimeout(() => {
      void (async () => {
        const found = await searchRequestClientsAction(q);
        if (seq !== searchSeqRef.current) return;
        if (!found.ok) {
          setResults([]);
          setError(found.error);
          setSearching(false);
          return;
        }
        setResults(found.results);
        setError(null);
        setSearching(false);
        setHighlight(found.results.length > 0 ? 0 : -1);
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function handleSelect(option: RequestClientOption) {
    onChange(option);
    closePicker();
  }

  function handleClear() {
    onChange(null);
    closePicker();
  }

  async function handleRetry() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    const seq = ++searchSeqRef.current;
    const found = await searchRequestClientsAction(q);
    if (seq !== searchSeqRef.current) return;
    if (!found.ok) {
      setResults([]);
      setError(found.error);
      setSearching(false);
      return;
    }
    setResults(found.results);
    setError(null);
    setSearching(false);
    setHighlight(found.results.length > 0 ? 0 : -1);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length === 0) return;
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setHighlight((h) => (h <= 0 ? results.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = highlight >= 0 ? results[highlight] : undefined;
      if (option) handleSelect(option);
    }
  }

  const trimmedQuery = query.trim();
  const showIdleHint = open && !trimmedQuery && !searching && !error;
  const showEmptyState = trimmedQuery !== "" && !searching && !error && results.length === 0;
  const showResults = trimmedQuery !== "" && !searching && !error && results.length > 0;

  return (
    <div ref={containerRef} className="relative" data-testid="request-client-picker">
      <div className="relative">
        <button
          type="button"
          onClick={() => (open ? closePicker() : openPicker())}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Client"
          data-testid="request-client-trigger"
          className={cn(
            "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            value ? "pr-8" : "",
          )}
        >
          <span className={cn("truncate text-left", !value && "text-muted-foreground")}>
            {value ? value.name : "Select client…"}
          </span>
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
            aria-label="Clear client"
            data-testid="request-client-clear"
            className="absolute right-8 top-1/2 z-10 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Client search results"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search for a client by name"
              aria-label="Search for a client by name"
              data-testid="request-client-search"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {searching && (
              <Loader2
                className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground"
                aria-label="Searching"
              />
            )}
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {showIdleHint && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                Search for a client by name.
              </p>
            )}

            {showEmptyState && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground" data-testid="request-client-empty">
                No clients found. Try another name.
              </p>
            )}

            {error && (
              <div className="px-3 py-4 text-center text-sm" data-testid="request-client-error">
                <p className="text-destructive">{error}</p>
                <button
                  type="button"
                  onClick={() => void handleRetry()}
                  className="mt-2 text-xs font-medium underline text-heading"
                >
                  Try again
                </button>
              </div>
            )}

            {showResults && results.map((option, index) => {
              const subtitle = requestClientSubtitle(option);
              const selected = value?.id === option.id;
              const active = index === highlight;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected || active}
                  data-testid={`request-client-option-${option.id}`}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlight(index)}
                  className={cn(
                    "flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-accent hover:text-accent-foreground",
                    (selected || active) && "bg-accent/60",
                  )}
                >
                  <span className="truncate text-sm">{option.name}</span>
                  {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
