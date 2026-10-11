import type { CSSProperties, ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const LIGHT_THEME_VARS = {
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
    <main
      data-theme-lock="light"
      className="flex min-h-svh flex-col items-center justify-center px-4 py-12"
      style={{
        background: "color-mix(in oklch, var(--linen), var(--taupe-dark) 45%)",
        ...LIGHT_THEME_VARS,
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Wordmark forceLight />
        </div>
        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {footer}
      </div>
    </main>
  );
}
