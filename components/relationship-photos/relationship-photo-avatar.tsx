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
 */
export function RelationshipPhotoAvatar({
  photoUrl,
  name,
  className,
  size = "lg",
}: {
  photoUrl: string | null | undefined;
  name: string;
  className?: string;
  size?: "default" | "sm" | "lg";
}) {
  const initials = initialsFromName(name);
  return (
    <Avatar size={size} className={cn("shrink-0", className)}>
      {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
      <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
