import type { CSSProperties, ReactNode } from "react";

/** Print/view pages for couple Docs — scrollable, no PortalShell chrome. */
const LIGHT_THEME_VARS = {
  "--background": "var(--true-white)",
  "--foreground": "var(--black)",
  "--card": "var(--true-white)",
  "--card-foreground": "var(--black)",
  "--popover": "var(--true-white)",
  "--popover-foreground": "var(--black)",
  "--heading": "var(--forest-sage)",
  "--muted": "var(--natural-cream)",
  "--muted-foreground": "color-mix(in oklch, var(--forest-sage) 70%, transparent)",
  "--secondary": "var(--natural-cream)",
  "--secondary-foreground": "var(--forest-sage)",
  "--border": "var(--taupe-light)",
  "--input": "var(--taupe-light)",
  "--ring": "var(--heritage-sage)",
  "--radius": "1rem",
  "--natural-cream": "#f7f5f1",
} as CSSProperties;

export default function PortalPrintLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-svh overflow-y-auto font-sans"
      style={{ ...LIGHT_THEME_VARS, background: "var(--natural-cream)" }}
    >
      {children}
    </div>
  );
}
