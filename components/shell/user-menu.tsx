"use client";

import { LogOut } from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "U";
  const namePart = trimmed.split("@")[0];
  const segments = namePart.split(/[._-]+/).filter(Boolean);
  const initials = segments
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("");
  return initials || namePart[0]?.toUpperCase() || "U";
}

/**
 * Account menu showing the signed-in user with a sign-out action.
 */
export function UserMenu({ email }: { email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-9 gap-2 px-2"
            aria-label="Account menu"
          />
        }
      >
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-xs">
            {getInitials(email)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[12rem] truncate text-sm sm:inline">
          {email}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void signOut();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
