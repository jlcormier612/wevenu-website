"use client";

import * as React from "react";
import Link from "next/link";

import {
  LibraryOverflowMenu,
  type LibraryOverflowItem,
} from "@/components/library/library-overflow-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type LibraryPrimaryAction = {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
  /** ghost = Preview, outline = Edit, default = Use */
  emphasis?: "preview" | "edit" | "use";
  disabled?: boolean;
};

export type LibraryAssetCardProps = {
  title: string;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  /** Domain-specific body (price, thumbnail, inclusion preview, etc.) */
  children?: React.ReactNode;
  badges?: React.ReactNode;
  isStarter?: boolean;
  isArchived?: boolean;
  primaryActions?: LibraryPrimaryAction[];
  overflowItems?: LibraryOverflowItem[];
  overflowPending?: boolean;
  /**
   * Retained for source compatibility. Library assets now use one canonical
   * full-width row presentation so a venue never learns a different card
   * interaction model for a different template family.
   */
  layout?: "grid" | "row";
  className?: string;
  /** Optional whole-card navigation (prefer primary Edit when possible) */
  href?: string;
};

function PrimaryButton({ action }: { action: LibraryPrimaryAction }) {
  const variant =
    action.emphasis === "use"
      ? "default"
      : action.emphasis === "edit"
        ? "outline"
        : "ghost";

  if (action.href) {
    return (
      <Button
        size="sm"
        variant={variant}
        disabled={action.disabled}
        render={<Link href={action.href} />}
      >
        {action.label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}

export function LibraryAssetCard({
  title,
  description,
  meta,
  children,
  badges,
  isStarter,
  isArchived,
  primaryActions = [],
  overflowItems = [],
  overflowPending,
  className,
  href,
}: LibraryAssetCardProps) {
  const titleBlock = (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-heading">{title}</p>
        {isStarter && !isArchived && (
          <Badge variant="muted" className="text-[10px]">Starter</Badge>
        )}
        {isArchived && (
          <Badge variant="muted" className="text-[10px]">Archived</Badge>
        )}
        {badges}
      </div>
      {description && (
        <p className="max-w-3xl truncate text-sm text-muted-foreground">{description}</p>
      )}
      {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
    </div>
  );

  const headerTrailing = (
    <div
      className="flex shrink-0 items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <LibraryOverflowMenu items={overflowItems} pending={overflowPending} />
    </div>
  );

  const actionsRow =
    primaryActions.length > 0 ? (
      <div
        className="flex flex-wrap items-center gap-2"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {primaryActions.map((action) => (
          <PrimaryButton key={action.id} action={action} />
        ))}
      </div>
    ) : null;

  return (
    <Card className={cn(isArchived && "opacity-60", className)}>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        {href ? (
          <Link href={href} className="min-w-0 flex-1">
            {titleBlock}
            {children}
          </Link>
        ) : (
          <div className="min-w-0 flex-1">
            {titleBlock}
            {children}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {actionsRow}
          {headerTrailing}
        </div>
      </CardContent>
    </Card>
  );
}
