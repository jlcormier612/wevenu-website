import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        // Soft fills use dark ink tokens — pale brand hues as text on
        // pale washes fail WCAG AA (e.g. dusty-rose on dusty/15 ≈ 1.9:1).
        default:     "bg-primary/15 text-foreground",
        secondary:   "bg-secondary text-secondary-foreground",
        accent:      "bg-accent/60 text-accent-foreground",
        outline:     "border border-border text-muted-foreground",
        success:     "bg-success/15 text-foreground",
        warning:     "bg-warning/20 text-warning-foreground",
        // Light: black ink on soft dusty wash. Dark: white on darkened dusty
        // (soft /25 over heritage fails white AA; ~65% dusty on black clears 4.5:1).
        destructive:
          "bg-destructive/25 text-destructive-foreground dark:bg-[color-mix(in_oklch,var(--destructive)_65%,black)] dark:text-white",
        muted:       "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
