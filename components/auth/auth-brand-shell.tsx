import type { CSSProperties, ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Always-light public/auth brand surface. Primary Wordmark (dark olive lettering)
 * is only legible on a light page chrome — never on theme-inherited `bg-muted`
 * (heritage-sage in dark mode).
 */
export const AUTH_BRAND_LIGHT_THEME_VARS = {
  "--background": "var(--true-white)",
  "--foreground": "var(--black)",
  "--card": "var(--true-white)",
  "--card-foreground": "var(--black)",
  "--popover": "var(--true-white)",
  "--popover-foreground": "var(--black)",
  "--heading": "var(--forest-sage)",
  "--muted": "var(--natural-cream)",
  "--muted-foreground": "color-mix(in oklch, var(--forest-sage) 80%, transparent)",
  "--secondary": "var(--natural-cream)",
  "--secondary-foreground": "var(--forest-sage)",
  "--primary": "var(--heritage-sage)",
  "--primary-foreground": "var(--true-white)",
  "--accent": "var(--soft-sage)",
  "--accent-foreground": "var(--forest-sage)",
  "--border": "var(--taupe-light)",
  "--input": "var(--taupe-light)",
  "--ring": "var(--heritage-sage)",
} as CSSProperties;

/** Page background + light token pin shared by all public auth Wordmark shells. */
export const AUTH_BRAND_PAGE_STYLE = {
  // Plain --linen was too close to the wordmark flower accent. --taupe-dark
  // mix keeps the page warm/on-brand while giving the primary mark real contrast.
  background: "color-mix(in oklch, var(--linen), var(--taupe-dark) 45%)",
  ...AUTH_BRAND_LIGHT_THEME_VARS,
} as CSSProperties;

/**
 * Light-locked frame with centered primary Wordmark. Use for invitation,
 * client login, team join, workspace chooser, and any public auth page that
 * previously used `bg-muted/40` (illegible primary logo under `.dark`).
 */
export function AuthBrandFrame({
  children,
  contentClassName,
}: {
  children: ReactNode;
  /** Defaults to max-w-sm; pass e.g. max-w-md for wider chooser cards. */
  contentClassName?: string;
}) {
  return (
    <main
      data-theme-lock="light"
      data-auth-brand-frame=""
      className="flex min-h-svh flex-col items-center justify-center px-4 py-12"
      style={AUTH_BRAND_PAGE_STYLE}
    >
      <div className={cn("flex w-full max-w-sm flex-col gap-6", contentClassName)}>
        <div className="flex justify-center">
          <Wordmark forceLight />
        </div>
        {children}
      </div>
    </main>
  );
}

export function AuthBrandShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AuthBrandFrame>
      <Card>
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer}
    </AuthBrandFrame>
  );
}
