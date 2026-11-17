import type { CSSProperties, ReactNode } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { bootstrapActiveVenueContext } from "@/lib/venue/active-context";

/**
 * Staff-authenticated Practice Run client perspective.
 * Uses the couple portal visual surface without the venue workspace chrome.
 */
const PORTAL_CELEBRATION_SOFT_B = {
  "--background": "#faf9f5",
  "--foreground": "#24332b",
  "--heading": "#24332b",
  "--card": "#ffffff",
  "--card-foreground": "#24332b",
  "--popover": "#ffffff",
  "--popover-foreground": "#24332b",
  "--muted": "color-mix(in oklch, #a7c2af 14%, #faf9f5)",
  "--muted-foreground": "#5f6f68",
  "--secondary": "#f3f0e9",
  "--secondary-foreground": "#24332b",
  "--primary": "#446b56",
  "--primary-foreground": "#ffffff",
  "--accent": "#a7c2af",
  "--accent-foreground": "#24332b",
  "--border": "#e6e3dc",
  "--input": "#e6e3dc",
  "--ring": "#446b56",
  "--destructive": "#d99a9e",
  "--destructive-foreground": "#24332b",
  "--radius": "1rem",
  "--htc-ivory": "#faf9f5",
  "--htc-canvas": "#faf9f5",
  "--htc-linen": "#f3f0e9",
  "--htc-botanical": "#446b56",
  "--natural-cream": "#faf9f5",
} as CSSProperties;

export const dynamic = "force-dynamic";

export default async function PracticeClientLayout({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) redirect("/login");
  const supabase = await createClient("venue");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await bootstrapActiveVenueContext();

  return (
    <div
      className="htc-staff h-svh overflow-hidden bg-background text-foreground"
      style={PORTAL_CELEBRATION_SOFT_B}
      data-theme-lock="light"
      data-testid="practice-client-layout"
    >
      {children}
    </div>
  );
}
