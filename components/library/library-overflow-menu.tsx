"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MoreHorizontal } from "lucide-react";

import { LIBRARY_LABELS } from "@/components/library/labels";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type LibraryOverflowItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
};

export function LibraryOverflowMenu({
  items,
  pending = false,
  align = "end",
  className,
}: {
  items: LibraryOverflowItem[];
  pending?: boolean;
  align?: "start" | "end" | "center";
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={className}
            disabled={pending}
            aria-label={LIBRARY_LABELS.optionsAria}
          />
        }
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MoreHorizontal className="h-3.5 w-3.5" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {items.map((item) => (
          <React.Fragment key={item.id}>
            {item.separatorBefore && <DropdownMenuSeparator />}
            {item.href ? (
              <DropdownMenuItem
                disabled={item.disabled}
                variant={item.destructive ? "destructive" : "default"}
                render={<Link href={item.href} />}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={item.disabled}
                variant={item.destructive ? "destructive" : "default"}
                onClick={item.onClick}
                className={cn(item.destructive && "text-destructive focus:text-destructive")}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            )}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
