import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

/**
 * Compact photo next to a Lead/Client name. When there is no photo, renders
 * initials only — never an empty photo box.
 *
 * When `editHref` is set, the avatar is a discoverable control to the photo
 * editor on the Lead/Client edit screen (editor is not inlined on the detail
 * header — that keeps the hospitality header calm).
 */
export function RelationshipPhotoAvatar({
  photoUrl,
  name,
  className,
  size = "lg",
  editHref,
}: {
  photoUrl: string | null | undefined;
  name: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  /** Lead/Client edit route that mounts RelationshipPhotoEditor. */
  editHref?: string;
}) {
  const initials = initialsFromName(name);
  const avatar = (
    <Avatar
      size={size}
      className={cn("shrink-0", editHref && "ring-offset-background transition-shadow hover:ring-2 hover:ring-primary/40", className)}
      data-testid="relationship-photo-avatar"
      data-relationship-photo={photoUrl ? "uploaded" : "initials"}
    >
      {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
      <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  if (!editHref) return avatar;

  return (
    <Link
      href={editHref}
      className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Edit photo for ${name}`}
      data-testid="relationship-photo-edit-link"
      title="Edit photo"
    >
      {avatar}
    </Link>
  );
}
