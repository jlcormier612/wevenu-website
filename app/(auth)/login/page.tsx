import type { Metadata } from "next";
import type { CSSProperties } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { Wordmark } from "@/components/brand/wordmark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in",
};

// This page is a fixed, always-light brand surface — it should look the
// same regardless of the visitor's system/app dark-mode preference. The
// `dark:` variant follows an ancestor `.dark` class (next-themes, class
// strategy), which a nested wrapper can't block via CSS descendant
// selectors alone. Re-pinning the semantic tokens actually consumed by
// Card/typography to their light-mode values on this wrapper overrides
// `.dark`'s reassignment for every descendant, regardless of system theme.
const LIGHT_THEME_VARS = {
  "--background": "var(--true-white)",
  "--foreground": "var(--black)",
  "--card": "var(--true-white)",
  "--card-foreground": "var(--black)",
  "--popover": "var(--true-white)",
  "--popover-foreground": "var(--black)",
  "--heading": "var(--forest-sage)",
  "--muted-foreground": "color-mix(in oklch, var(--forest-sage) 70%, transparent)",
  "--border": "var(--taupe-light)",
  "--input": "var(--taupe-light)",
  "--ring": "var(--heritage-sage)",
} as CSSProperties;

export default function LoginPage() {
  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center px-4 py-12"
      style={{
        // Plain --linen was too close in tone to the wordmark's flower
        // petal accent, which nearly disappeared against it. A few shades
        // darker (toward --taupe-light) keeps the page light while giving
        // the logo real contrast.
        background: "color-mix(in oklch, var(--linen), var(--taupe-light) 60%)",
        ...LIGHT_THEME_VARS,
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Wordmark forceLight />
        </div>

        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-xl">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your venue workspace to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>

        {!isSupabaseConfigured ? (
          <p className="text-center text-xs text-muted-foreground">
            Authentication backend is not configured in this environment. Set
            the Supabase environment variables to enable sign in.
          </p>
        ) : null}
      </div>
    </main>
  );
}
