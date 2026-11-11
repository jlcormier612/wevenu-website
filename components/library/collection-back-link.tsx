"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Destination-named escape path for library/catalog editors.
 * Prefer this over browser-history "Back" so the customer always knows where they go.
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
