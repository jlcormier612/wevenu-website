"use client";

import * as React from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const DUSTY_ROSE = "#D8A7AA";

type DraftSection = { title: string; content: string };

function parseSections(text: string): DraftSection[] {
  if (!text) return [];
  if (!text.includes("## ")) return [{ title: "", content: text }];
  return text
    .split(/## /)
    .filter(p => p.trim())
    .map(part => {
      const nl = part.indexOf("\n");
      if (nl === -1) return { title: part.trim(), content: "" };
      return { title: part.slice(0, nl).trim(), content: part.slice(nl + 1).trim() };
    });
}

function CopyButton({
  text,
  size = "sm",
  onAfterCopy,
}: {
  text:         string;
  size?:        "sm" | "xs";
  onAfterCopy?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onAfterCopy?.();
  }

  const isXs = size === "xs";
  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex items-center gap-1 font-medium rounded-md transition-opacity hover:opacity-80"
      style={{
        fontSize:   isXs ? "10px" : "11px",
        padding:    isXs ? "2px 6px" : "3px 8px",
        background: `color-mix(in oklch, ${DUSTY_ROSE} 10%, transparent)`,
        color:      "var(--heading)",
      }}
    >
      {copied
        ? <><Check style={{ width: isXs ? 11 : 12, height: isXs ? 11 : 12 }} /> Copied</>
        : <><Copy style={{ width: isXs ? 11 : 12, height: isXs ? 11 : 12 }} /> Copy</>}
    </button>
  );
}

function ErrorBanner({
  message,
  onRetry,
  compact = false,
}: {
  message:  string;
  onRetry:  () => void;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-lg border border-border/50 ${compact ? "p-3" : "p-4"} space-y-2`}>
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs font-medium transition-opacity hover:opacity-80"
        style={{ color: DUSTY_ROSE }}
      >
        Try again →
      </button>
    </div>
  );
}

export function LuvDraftSheet({
  open,
  onOpenChange,
  action,
  context,
  title,
  actionId,
  onCopiedWithoutActionId,
}: {
  open:                      boolean;
  onOpenChange:              (open: boolean) => void;
  action:                    string;
  context:                   Record<string, unknown>;
  title:                     string;
  actionId?:                 string | null;
  onCopiedWithoutActionId?:  () => void;
}) {
  const [text,            setText]            = React.useState("");
  const [loading,         setLoading]         = React.useState(false);
  const [done,            setDone]            = React.useState(false);
  const [error,           setError]           = React.useState<string | null>(null);
  const [retryCount,      setRetryCount]      = React.useState(0);
  const [actionCompleted, setActionCompleted] = React.useState(false);

  React.useEffect(() => {
    if (!open || !action) return;

    setText("");
    setDone(false);
    setError(null);
    setLoading(true);
    setActionCompleted(false);

    let timedOut = false;
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30_000);

    (async () => {
      try {
        const res = await fetch("/api/luv/draft", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ action, context }),
          signal:  controller.signal,
        });

        setLoading(false);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(
            (body as { error?: string }).error ??
            "Something went wrong. Please try again."
          );
          setDone(true);
          return;
        }

        if (!res.body) {
          setError("No response received. Please try again.");
          setDone(true);
          return;
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          setText(prev => prev + decoder.decode(value, { stream: true }));
        }

        setDone(true);
      } catch (err) {
        setLoading(false);
        if ((err as Error).name === "AbortError") {
          if (timedOut) {
            setError("Luv took too long to respond. Please try again.");
            setDone(true);
          }
          // else: sheet was closed mid-stream — no error
        } else {
          // Mid-stream network failure: partial text may already be visible
          setError("Luv's response was cut short. You can use what's here or try again.");
          setDone(true);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    })();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, action, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean stream completion with no text = treat as error
  React.useEffect(() => {
    if (done && !error && text.length === 0) {
      setError("Luv couldn't generate a draft this time. Please try again.");
    }
  }, [done, error, text]);

  function handleRetry() {
    setRetryCount(c => c + 1);
  }

  function markActionComplete() {
    if (actionCompleted) return;
    setActionCompleted(true);
    if (actionId) {
      fetch(`/api/luv/actions/${actionId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "complete" }),
      }).catch(() => {/* best effort */});
    } else {
      // actionId not yet hydrated — signal the parent to complete when it arrives
      onCopiedWithoutActionId?.();
    }
  }

  const sections        = parseSections(text);
  const completedCount  = done ? sections.length : sections.length - 1;
  const hasContent      = sections.length > 0;
  const showFullError   = !!error && !hasContent;
  const showInlineError = !!error && hasContent;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md p-0 gap-0">
        <SheetHeader className="border-b border-border/40 px-4 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <LuvHeart size={14} />
            <SheetTitle>{title || "Luv draft"}</SheetTitle>
          </div>
          <SheetDescription>
            Drafted by Luv — edit and personalize before sending.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: DUSTY_ROSE }} />
              <span>Luv is drafting...</span>
            </div>
          )}

          {showFullError && (
            <ErrorBanner message={error} onRetry={handleRetry} />
          )}

          {!loading && hasContent && sections.map((section, i) => {
            const isComplete  = i < completedCount;
            const isStreaming = !done && i === sections.length - 1;
            return (
              <div key={i} className="rounded-lg border border-border/50 p-3 space-y-2">
                {section.title && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {section.title}
                    </p>
                    {isComplete && section.content && (
                      <CopyButton text={section.content} size="xs" onAfterCopy={markActionComplete} />
                    )}
                  </div>
                )}
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {section.content}
                  {isStreaming && (
                    <span
                      className="ml-0.5 inline-block w-0.5 h-[1em] align-text-bottom animate-pulse"
                      style={{ backgroundColor: DUSTY_ROSE }}
                      aria-hidden
                    />
                  )}
                </p>
              </div>
            );
          })}

          {/* Shown below partial content when stream fails mid-way */}
          {showInlineError && (
            <ErrorBanner message={error} onRetry={handleRetry} compact />
          )}
        </div>

        {done && !error && text.length > 0 && (
          <div className="border-t border-border/40 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <LuvHeart size={11} />
              <p className="text-xs text-muted-foreground">Personalize before sending.</p>
            </div>
            <CopyButton text={text} size="sm" onAfterCopy={markActionComplete} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
