"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

type SearchResult = {
  id: string;
  kind: "lead" | "event" | "vendor" | "guest" | "document" | "task";
  title: string;
  subtitle: string | null;
  link: string;
  emoji: string;
};

type SearchResponse = {
  results?: SearchResult[];
  error?: string;
};

const KIND_ORDER = ["lead", "event", "vendor", "guest", "document", "task"] as const;

const KIND_LABELS: Record<string, string> = {
  lead:     "Leads",
  event:    "Events",
  vendor:   "Vendors",
  guest:    "Guests",
  document: "Documents",
  task:     "Tasks",
};

function groupResults(results: SearchResult[]) {
  const map = new Map<string, SearchResult[]>();
  for (const r of results) {
    if (!map.has(r.kind)) map.set(r.kind, []);
    map.get(r.kind)!.push(r);
  }
  return KIND_ORDER
    .filter(k => map.has(k))
    .map(k => ({ kind: k, label: KIND_LABELS[k]!, items: map.get(k)! }));
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery]           = React.useState("");
  const [results, setResults]       = React.useState<SearchResult[]>([]);
  const [loading, setLoading]       = React.useState(false);
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  const inputRef    = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K / Ctrl+K
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  // Reset + focus on open
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced search
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json() as SearchResponse;
        setResults(data.results ?? []);
        setSelectedIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function navigate(link: string) {
    onOpenChange(false);
    router.push(link);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "Escape":
        onOpenChange(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
        break;
      case "Enter": {
        const r = results[selectedIdx];
        if (r) navigate(r.link);
        break;
      }
    }
  }

  if (!open) return null;

  const groups = groupResults(results);
  const hasQuery = query.trim() !== "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4"
      style={{ paddingTop: "12vh", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-[580px] rounded-2xl border bg-background shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search leads, events, vendors, guests, documents, tasks…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5 select-none items-center rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results area */}
        <div className="max-h-[440px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />
            </div>
          ) : hasQuery && results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-heading mb-1">No results</p>
              <p className="text-xs text-muted-foreground">Nothing matched "{query}"</p>
            </div>
          ) : !hasQuery ? (
            <div className="py-12 text-center px-8">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Search across leads, events, vendors, guests, documents, and tasks.
              </p>
              <p className="mt-3 text-xs text-muted-foreground/50">
                ↑↓ to navigate · ↵ to open · Esc to close
              </p>
            </div>
          ) : (
            <div className="py-1.5">
              {groups.map(group => (
                <div key={group.kind}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
                    {group.label}
                  </p>
                  {group.items.map(item => {
                    const flatIdx  = results.indexOf(item);
                    const selected = flatIdx === selectedIdx;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(item.link)}
                        onMouseEnter={() => setSelectedIdx(flatIdx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          selected ? "bg-accent" : "hover:bg-accent/50"
                        }`}
                      >
                        <span className="text-lg shrink-0 w-7 text-center leading-none">{item.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-heading truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs text-muted-foreground truncate capitalize">{item.subtitle}</p>
                          )}
                        </div>
                        {selected && (
                          <kbd className="hidden sm:inline-flex h-5 shrink-0 items-center rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                            ↵
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="border-t px-4 py-2 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
