"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

const SETUP_QUERY_KEYS = ["from", "setupSection", "setupReturn", "setupReturnLabel"] as const;

/**
 * Destination-named escape path for library/catalog editors.
 * Prefer this over browser-history "Back" so the customer always knows where they go.
 *
 * When opened from Easy Onboarding, the Library/Templates escape is hidden so the
 * onboarding return link is the single path. Collection-to-parent links stay and
 * keep the setup-return query.
 */
export function CollectionBackLink({
  href,
  label,
  confirmLeave,
}: {
  href: string;
  /** Collection / parent space name, e.g. "Event Order Templates". */
  label: string;
  /** Return false to cancel navigation (unsaved-changes confirm). */
  confirmLeave?: () => boolean;
}) {
  return (
    <Suspense fallback={<CollectionBackLinkControl href={href} label={label} confirmLeave={confirmLeave} />}>
      <CollectionBackLinkInner href={href} label={label} confirmLeave={confirmLeave} />
    </Suspense>
  );
}

function CollectionBackLinkInner({
  href,
  label,
  confirmLeave,
}: {
  href: string;
  label: string;
  confirmLeave?: () => boolean;
}) {
  const params = useSearchParams();
  const fromSetupHub = params.get("from") === "setup-hub";
  if (fromSetupHub && isLibraryEscape(href)) return null;
  const dest = fromSetupHub ? withSetupQuery(href, params) : href;
  return <CollectionBackLinkControl href={dest} label={label} confirmLeave={confirmLeave} />;
}

function isLibraryEscape(href: string): boolean {
  return href === "/library" || href.startsWith("/library?");
}

function withSetupQuery(href: string, params: URLSearchParams): string {
  const url = new URL(href, "https://htc.invalid");
  for (const key of SETUP_QUERY_KEYS) {
    const value = params.get(key);
    if (value) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function CollectionBackLinkControl({
  href,
  label,
  confirmLeave,
}: {
  href: string;
  label: string;
  confirmLeave?: () => boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 text-muted-foreground"
      render={<Link href={href} />}
      onClick={(e) => {
        if (confirmLeave && !confirmLeave()) e.preventDefault();
      }}
    >
      <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {label}
    </Button>
  );
}
