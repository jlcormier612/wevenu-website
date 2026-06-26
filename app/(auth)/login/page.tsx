import type { Metadata } from "next";

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

export default function LoginPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Wordmark />
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
